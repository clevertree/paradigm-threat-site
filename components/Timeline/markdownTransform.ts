/**
 * Transforms standalone markdown images into PopImage components.
 * Handles: ![alt](url) -> <PopImage src="url" alt="alt" />
 *
 * Caption convention: an image line immediately followed by a non-blank line
 * (no blank line between) is treated as image + caption and rendered as a
 * semantic <figure>/<figcaption> block:
 *
 *   ![alt](url)
 *   *Caption text with [links](url) and *italic* spans.*
 *   →
 *   <PopImage src="url" alt="Caption text (plain)">caption line</PopImage>
 *
 * When a caption is present, the caption markdown is passed as children to
 * PopImage (rendered inside the image border). The alt attribute uses the
 * plain-text version of the caption for accessibility.
 *
 * Tailwind's `prose` styles render figcaption as small, italic, muted text.
 * No default classes; use JSON-in-title for per-image styling: ![alt](url?w=360 '{"className":"..."}').
 */

/**
 * Strip markdown formatting to produce plain text (for alt attributes).
 * Handles: *italic*, **bold**, [text](url), `code`.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')            // *italic* → italic
    .replace(/`([^`]+)`/g, '$1')              // `code` → code
    .trim()
}

/**
 * Transform markdown images (optionally followed by a caption line) to
 * PopImage / figure+figcaption components.
 *
 * When a caption is present, the caption text (stripped of markdown) is used
 * as the alt attribute instead of the original alt text from ![alt](...).
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''

  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  // Image immediately followed by one or more caption lines (no blank line between).
  // Captured group 3 is all consecutive non-blank lines as raw markdown.
  const imageWithCaption = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\n([^\n]+(?:\n[^\n]+)*)/g

  let result = md.replace(imageWithCaption, (match, _alt, url, caption) => {
    const captionPlain = stripMarkdown(caption).replace(/"/g, '&quot;')
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${captionPlain}">${caption}</PopImage>`
  })

  // Remaining standalone images with no following caption line.
  result = result.replace(imagePattern, (match, alt, url) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" />`
  })

  return result
}
