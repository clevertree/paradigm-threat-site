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
