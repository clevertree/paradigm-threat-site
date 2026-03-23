const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'] as const
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

/** 0–99 as spoken English (e.g. 61 -> "sixty-one"). */
function under100(n: number): string {
    if (n < 10) return UNITS[n] ?? String(n)
    if (n < 20) return TEENS[n - 10] ?? String(n)
    const t = Math.floor(n / 10)
    const u = n % 10
    const ten = TENS[t]
    if (!ten) return String(n)
    return u ? `${ten}-${UNITS[u]}` : ten
}

/** 100–999 */
function under1000(n: number): string {
    if (n < 100) return under100(n)
    const h = Math.floor(n / 100)
    const r = n % 100
    const head = h === 1 ? 'one hundred' : `${UNITS[h]} hundred`
    return r ? `${head} ${under100(r)}` : head
}

/** 2100–9999 as "two thousand one hundred …" */
function yearBig(n: number): string {
    const th = Math.floor(n / 1000)
    const rem = n % 1000
    if (rem === 0) return `${under100(th)} thousand`
    if (rem < 100) return `${under100(th)} thousand ${under100(rem)}`
    return `${under100(th)} thousand ${under1000(rem)}`
}

/**
 * Calendar / history year to spoken English (TTS-friendly).
 * e.g. 1761 -> "seventeen sixty-one", 2005 -> "two thousand five", 2019 -> "twenty nineteen".
 */
export function yearToWords(y: number): string {
    const n = Math.floor(Math.abs(y))
    if (!Number.isFinite(n) || n <= 0) return String(y)
    if (n < 100) return under100(n)
    if (n < 1000) return under1000(n)
    if (n < 2000) {
        const c = Math.floor(n / 100)
        const r = n % 100
        if (c === 10 && r === 0) return 'one thousand'
        const cw = under100(c)
        if (r === 0) return `${cw} hundred`
        return `${cw} ${under100(r)}`
    }
    if (n < 2010) {
        const r = n % 1000
        if (r === 0) return 'two thousand'
        if (r < 10) return `two thousand ${UNITS[r]}`
        return `two thousand ${under100(r)}`
    }
    if (n < 2100) {
        const r = n % 100
        if (r === 0) return 'twenty hundred'
        return `twenty ${under100(r)}`
    }
    if (n < 10000) return yearBig(n)
    return String(n)
}

/** Word-boundary guard: avoid evt-1185-crucifixion and similar slugs. */
const Y4 = '(?<![\\w-])(\\d{4})(?![\\w-])'
const Y1_4 = '(?<![\\w-])(\\d{1,4})(?![\\w-])'

/**
 * Replace common date/year patterns with spoken forms so TTS reads clearly.
 * Runs after markdown strip; safe to call twice (idempotent on output).
 */
export function expandDatesForTTS(text: string): string {
    let s = text

    // circa + BCE/BCE
    s = s.replace(
        new RegExp(`\\bc\\.\\s*${Y1_4}\\s*(?:BCE|B\\.C\\.E\\.)\\b`, 'gi'),
        (_, y: string) => `circa ${yearToWords(+y)} before common era`,
    )
    s = s.replace(
        new RegExp(`\\bc\\.\\s*${Y1_4}\\s*(?:BC|B\\.C\\.)\\b`, 'g'),
        (_, y: string) => `circa ${yearToWords(+y)} before Christ`,
    )

    // Year + BCE / BC
    s = s.replace(
        new RegExp(`${Y1_4}\\s*(?:BCE|B\\.C\\.E\\.)\\b`, 'gi'),
        (_, y: string) => `${yearToWords(+y)} before common era`,
    )
    s = s.replace(
        new RegExp(`${Y1_4}\\s*(?:BC|B\\.C\\.)\\b`, 'g'),
        (_, y: string) => `${yearToWords(+y)} before Christ`,
    )

    // AD / CE after year (no leading "in" — prose often already has "In …")
    s = s.replace(
        new RegExp(`\\b(?:AD|A\\.D\\.)\\s*${Y4}\\b`, 'gi'),
        (_, y: string) => yearToWords(+y),
    )
    s = s.replace(
        new RegExp(`${Y4}\\s*(?:CE|C\\.E\\.)\\b`, 'gi'),
        (_, y: string) => yearToWords(+y),
    )

    // Year ranges (en dash, em dash, or hyphen between two years)
    s = s.replace(
        new RegExp(`${Y4}\\s*[–—-]\\s*${Y4}\\b`, 'g'),
        (_, a: string, b: string) => `${yearToWords(+a)} to ${yearToWords(+b)}`,
    )

    // Centuries: 17th century, 5th c.
    s = s.replace(/\b(\d{1,2})(?:st|nd|rd|th)\s+century\b/gi, (_, d: string) => `${centuryOrdinal(+d)} century`)
    s = s.replace(/\b(\d{1,2})(?:st|nd|rd|th)\s+c\.\b/gi, (_, d: string) => `${centuryOrdinal(+d)} century`)

    // Standalone 4-digit years (history range); not adjacent to letters/hyphens (slugs)
    s = s.replace(new RegExp(Y4, 'g'), (m) => yearToWords(+m))

    return s
}

/**
 * Latin and scholarly Latinisms → English or omission. Piper often mispronounces Latin;
 * Web Speech is inconsistent — same output for both so captions match audio.
 * Longer / multi-word patterns first. Empty replace removes the phrase; whitespace collapsed at end.
 */
export function normalizeLatinForTTS(text: string): string {
    let s = text
    const rules: { pattern: RegExp; replace: string }[] = [
        { pattern: /\[\s*sic\s*\]/gi, replace: '' },
        { pattern: /\bexempli gratia\b/gi, replace: 'for example' },
        { pattern: /\bid est\b/gi, replace: 'that is' },
        { pattern: /\bet cetera\b/gi, replace: 'and so on' },
        { pattern: /\bet alii\b/gi, replace: 'and others' },
        { pattern: /\binter alia\b/gi, replace: 'among other things' },
        { pattern: /\bmutatis mutandis\b/gi, replace: '' },
        { pattern: /\bceteris paribus\b/gi, replace: '' },
        { pattern: /\bsui generis\b/gi, replace: 'of its own kind' },
        { pattern: /\bprima facie\b/gi, replace: 'at first sight' },
        { pattern: /\bipso facto\b/gi, replace: 'by that very fact' },
        { pattern: /\bstatus quo\b/gi, replace: 'existing state' },
        { pattern: /\bde facto\b/gi, replace: 'in fact' },
        { pattern: /\bde jure\b/gi, replace: 'in law' },
        { pattern: /\bad hoc\b/gi, replace: 'for this purpose' },
        { pattern: /\bad nauseam\b/gi, replace: '' },
        { pattern: /\bbona fide\b/gi, replace: 'good faith' },
        { pattern: /\bvice versa\b/gi, replace: 'the other way around' },
        { pattern: /\bquid pro quo\b/gi, replace: 'exchange' },
        { pattern: /\bhabeas corpus\b/gi, replace: '' },
        { pattern: /\bmens rea\b/gi, replace: '' },
        { pattern: /\bpro bono\b/gi, replace: 'for the public good' },
        { pattern: /\bpro forma\b/gi, replace: 'as a formality' },
        { pattern: /\bin vitro\b/gi, replace: 'in the lab' },
        { pattern: /\bin vivo\b/gi, replace: 'in living tissue' },
        { pattern: /\bin situ\b/gi, replace: 'in place' },
        { pattern: /\bin memoriam\b/gi, replace: 'in memory of' },
        { pattern: /\bpost mortem\b/gi, replace: 'after death' },
        { pattern: /\bpost hoc\b/gi, replace: 'after the fact' },
        { pattern: /\bargumentum ad hominem\b/gi, replace: '' },
        { pattern: /\bargumentum ad nauseam\b/gi, replace: '' },
        { pattern: /\bargumentum ad populum\b/gi, replace: '' },
        { pattern: /\bab initio\b/gi, replace: 'from the beginning' },
        { pattern: /\bex nihilo\b/gi, replace: 'from nothing' },
        { pattern: /\bex hypothesi\b/gi, replace: '' },
        { pattern: /\bex post facto\b/gi, replace: 'retroactive' },
        { pattern: /\bsub judice\b/gi, replace: '' },
        { pattern: /\bterra nullius\b/gi, replace: 'unclaimed land' },
        { pattern: /\banno domini\b/gi, replace: '' },
        // Latin "pace" (with respect to X's opinion) before a proper name — not English "pace"
        { pattern: /\bpace\s+([A-Z][a-z]+)\b/gi, replace: 'with respect to $1' },
        { pattern: /\bet al\.?\b/gi, replace: 'and others' },
        { pattern: /\be\.?\s*g\.?\b/gi, replace: 'for example' },
        { pattern: /\bi\.?\s*e\.?\b/gi, replace: 'that is' },
        { pattern: /\betc\.?\b/gi, replace: 'and so on' },
        { pattern: /\bcf\.?\b/gi, replace: 'compare' },
        { pattern: /\bviz\.?\b/gi, replace: 'namely' },
        { pattern: /\bibid\.?\b/gi, replace: '' },
        { pattern: /\bop\.?\s*cit\.?\b/gi, replace: '' },
        { pattern: /\bloc\.?\s*cit\.?\b/gi, replace: '' },
        { pattern: /\bvs\.?\b/gi, replace: 'versus' },
        { pattern: /\bv\.?\s*s\.?\b/gi, replace: 'versus' },
        { pattern: /\bsic\b/gi, replace: '' },
    ]
    for (const { pattern, replace } of rules) {
        s = s.replace(pattern, replace)
    }
    return s
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/([,.!?;:])\s*([,.!?;:])/g, '$1 $2')
        .trim()
}

/** Dates then Latin — single entry point for TTS preprocessing. */
export function preprocessSpeechText(text: string): string {
    return normalizeLatinForTTS(expandDatesForTTS(text))
}

function centuryOrdinal(n: number): string {
    if (n < 1 || n > 99) return `${n}th`
    const o = [
        '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
        'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
    ]
    if (n <= 20) return o[n] ?? `${n}th`
    if (n < 30) {
        const u = n % 10
        return u ? `twenty-${o[u]}` : 'twentieth'
    }
    if (n < 40) return n === 30 ? 'thirtieth' : `thirty-${o[n - 30]}`
    if (n < 50) return n === 40 ? 'fortieth' : `forty-${o[n - 40]}`
    if (n < 60) return n === 50 ? 'fiftieth' : `fifty-${o[n - 50]}`
    if (n < 70) return n === 60 ? 'sixtieth' : `sixty-${o[n - 60]}`
    if (n < 80) return n === 70 ? 'seventieth' : `seventy-${o[n - 70]}`
    if (n < 90) return n === 80 ? 'eightieth' : `eighty-${o[n - 80]}`
    return n === 90 ? 'ninetieth' : `ninety-${o[n - 90]}`
}

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
    let result = merged.filter(s => s.length > 0)
    // Recurring bug: last two TTS entries often showed same text. Strip trailing duplicate
    // so the final two displayed sentences are never identical.
    while (result.length >= 2 && result[result.length - 1] === result[result.length - 2]) {
        result = result.slice(0, -1)
    }
    return result
}

/**
 * Compute paragraph start indices: paragraphStarts[i] = first sentence index of paragraph i.
 * Use: for sentence index s, paragraph index = largest i where paragraphStarts[i] <= s.
 */
export function buildParagraphStarts(text: string): number[] {
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  const starts: number[] = [0]
  let idx = 0
  for (const para of paras) {
    idx += splitSentences(para).length
    starts.push(idx)
  }
  return starts
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

    const body = title ? `${title}. ${text}` : text
    return preprocessSpeechText(body)
}
