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
 *   <figure><PopImage src="url" alt="alt" /><figcaption>caption line</figcaption></figure>
 *
 * Tailwind's `prose` styles render figcaption as small, italic, muted text.
 * No default classes; use JSON-in-title for per-image styling: ![alt](url?w=360 '{"className":"..."}').
 */

/**
 * Transform markdown images (optionally followed by a caption line) to
 * PopImage / figure+figcaption components.
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''

  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  // Image immediately followed by one or more caption lines (no blank line between).
  // Captured group 3 is all consecutive non-blank lines as raw markdown.
  const imageWithCaption = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\n([^\n]+(?:\n[^\n]+)*)/g

  let result = md.replace(imageWithCaption, (match, alt, url, caption) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<figure><PopImage src="${safeUrl}" alt="${safeAlt}" /><figcaption>${caption}</figcaption></figure>`
  })

  // Remaining standalone images with no following caption line.
  result = result.replace(imagePattern, (match, alt, url) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" />`
  })

  return result
}
