/**
 * Split text into speakable sentences.
 * - Handles abbreviations like B.C., A.D., c., e.g., i.e., etc. without breaking
 * - Treats each line/paragraph as at least one sentence
 * - Merges very short fragments into the previous sentence
 */
export function splitSentences(text: string): string[] {
    const ABBR_PLACEHOLDER = '\x00'
    const ABBREVIATIONS = /\b(B\.C|A\.D|B\.C\.E|C\.E|A\.M|P\.M|e\.g|i\.e|etc|vs|approx|ca?|Mr|Mrs|Ms|Dr|Jr|Sr|St|Prof|Gen|Gov|Sgt|Lt|Col|Capt|Rev|Vol|No|Fig|Dept|Univ|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi

    let safe = text.replace(ABBREVIATIONS, (m) => m.slice(0, -1) + ABBR_PLACEHOLDER)
    safe = safe.replace(/\b([A-Z])\./g, '$1' + ABBR_PLACEHOLDER)
    safe = safe.replace(/(\d)\.(\d)/g, '$1' + ABBR_PLACEHOLDER + '$2')

    const lines = safe.split(/\n+/).filter(l => l.trim())
    const allSentences: string[] = []
    for (const line of lines) {
        const raw = line.match(/[^.!?]*[.!?]+(?:\s+|$)/g)
        if (!raw) {
            const restored = line.trim().replaceAll(ABBR_PLACEHOLDER, '.')
            if (restored) allSentences.push(restored)
            continue
        }
        const joined = raw.join('')
        const leftover = line.substring(joined.length).trim()
        if (leftover) raw.push(leftover)
        for (const s of raw) {
            const restored = s.trim().replaceAll(ABBR_PLACEHOLDER, '.')
            if (restored) allSentences.push(restored)
        }
    }

    const merged: string[] = []
    for (const s of allSentences) {
        if (merged.length > 0 && s.length < 30) {
            merged[merged.length - 1] += ' ' + s
        } else {
            merged.push(s)
        }
    }
    return merged.filter(s => s.length > 0)
}

/**
 * Strip markdown formatting from an event's content so it can be read aloud.
 * - Removes YAML frontmatter
 * - Removes image tags
 * - Converts links to their text
 * - Removes all markdown symbols
 * - Prepends the event title
 */
export function stripMarkdownForTTS(md: string, title: string): string {
    let text = md
        // Remove YAML frontmatter
        .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
        // Remove H1 (title line — we'll prepend it separately)
        .replace(/^# .+\n*/m, '')
        // Remove image tags entirely
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        // Remove <PopImage ...> tags from markdown transform
        .replace(/<PopImage[^>]*\/>/g, '')
        // Convert links to text only
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove heading markers but keep text
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic/strikethrough/code
        .replace(/[*_~`]+/g, '')
        // Remove blockquote markers
        .replace(/^>\s*/gm, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Remove table header separator rows entirely
        .replace(/^\|[-: |]+\|\s*$/gm, '')
        // Convert table rows: each row becomes a sentence.
        // Split cells on |, trim, filter empties, join with " — ", append period.
        .replace(/^\|(.+)\|\s*$/gm, (_match, cells: string) => {
            const parts = cells.split('|').map((c: string) => c.trim()).filter(Boolean)
            return parts.join(' — ') + '.'
        })
        // Clean any remaining stray pipes
        .replace(/\|/g, ' ')
        // Collapse whitespace
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim()

    return title ? `${title}. ${text}` : text
}
