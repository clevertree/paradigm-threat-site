'use client'

import { useEffect, useState } from 'react'

type FontKey = 'garamond' | 'franklin' | 'mono'

const FONTS: { key: FontKey; label: string; title: string }[] = [
    { key: 'garamond', label: 'Ag', title: 'EB Garamond (serif)' },
    { key: 'franklin', label: 'Ag', title: 'Libre Franklin (sans-serif)' },
    { key: 'mono', label: 'Ag', title: 'JetBrains Mono (monospace)' },
]

const FONT_STYLES: Record<FontKey, string> = {
    garamond: "'EB Garamond', Georgia, serif",
    franklin: "'Libre Franklin', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
}

export default function FontToggle() {
    const [font, setFont] = useState<FontKey>('garamond')

    useEffect(() => {
        const saved = localStorage.getItem('content-font') as FontKey | null
        if (saved && FONTS.some(f => f.key === saved)) {
            setFont(saved)
            applyFont(saved)
        }
    }, [])

    function applyFont(key: FontKey) {
        if (key === 'garamond') {
            document.documentElement.removeAttribute('data-font')
        } else {
            document.documentElement.setAttribute('data-font', key)
        }
    }

    const cycleFont = () => {
        const idx = FONTS.findIndex(f => f.key === font)
        const next = FONTS[(idx + 1) % FONTS.length]
        setFont(next.key)
        localStorage.setItem('content-font', next.key)
        applyFont(next.key)
    }

    const current = FONTS.find(f => f.key === font)!

    return (
        <button
            onClick={cycleFont}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-medium leading-none w-9 h-9 flex items-center justify-center"
            title={`Font: ${current.title} — click to cycle`}
            style={{ fontFamily: FONT_STYLES[font] }}
        >
            {current.label}
        </button>
    )
}
