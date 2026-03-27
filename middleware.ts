import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Hostnames: `/` rewrites internally to `/book` (markdown at `book/page.md` in paradigm-threat-files). */
const LANDING_HOSTS = new Set(['thirdstory.site', 'www.thirdstory.site'])

function landingHost (host: string | null): boolean {
  if (!host) return false
  const h = host.split(':')[0]?.toLowerCase() ?? ''
  return LANDING_HOSTS.has(h)
}

export function middleware (request: NextRequest) {
  const host = request.headers.get('host')
  const { pathname } = request.nextUrl

  // Optional: old path from first-party landing experiment
  if (pathname === '/book-landing') {
    return NextResponse.redirect(new URL('/book', request.url))
  }

  if (pathname === '/' && landingHost(host)) {
    return NextResponse.rewrite(new URL('/book', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/book-landing'],
}
