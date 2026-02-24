import { NextRequest, NextResponse } from 'next/server'
import { PIPER_API_URL, PIPER_API_SECRET, isPiperConfigured } from '@/lib/tts/piperConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PiperRequestBody {
    text: string
    voiceId?: string
    rate?: number
}

export async function POST(req: NextRequest) {
    if (!isPiperConfigured()) {
        return NextResponse.json({ error: 'Piper TTS not configured.' }, { status: 503 })
    }

    let body: PiperRequestBody
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const text = body.text?.trim()
    if (!text) {
        return NextResponse.json({ error: 'Missing text.' }, { status: 400 })
    }

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (PIPER_API_SECRET) {
            headers['Authorization'] = `Bearer ${PIPER_API_SECRET}`
        }

        // Hard timeout: 28s — Vercel/nginx typically kills at 30s, give ourselves a clean exit
        const upstreamSignal = AbortSignal.timeout(28_000)

        let upstream: Response
        try {
            upstream = await fetch(`${PIPER_API_URL}/tts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text,
                    voiceId: body.voiceId,
                    rate: body.rate,
                }),
                signal: upstreamSignal,
            })
        } catch (fetchErr) {
            const isTimeout = fetchErr instanceof Error && fetchErr.name === 'TimeoutError'
            const msg = isTimeout
                ? `Piper upstream timed out after 28s (text length: ${text.length})`
                : `Piper upstream unreachable: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
            console.error('[TTS PROXY]', msg)
            return NextResponse.json({ error: msg }, { status: 504 })
        }

        if (!upstream.ok) {
            const errBody = await upstream.text()
            let msg = `Piper server error (${upstream.status})`
            try { msg = JSON.parse(errBody).error ?? msg } catch { }
            console.error('[TTS PROXY] upstream error:', upstream.status, msg)
            return NextResponse.json({ error: msg }, { status: upstream.status })
        }

        const audio = await upstream.arrayBuffer()
        return new NextResponse(new Uint8Array(audio), {
            status: 200,
            headers: {
                'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/wav',
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown TTS proxy error'
        console.error('[TTS PROXY ERROR]', message)
        return NextResponse.json({ error: message }, { status: 502 })
    }
}
