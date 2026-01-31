/**
 * Transforms standalone markdown images into PopImage components.
 * Handles: ![alt](url) -> <PopImage src="url" alt="alt" />
 * Alt text is rendered as caption below the image.
 * No default classes; use JSON-in-title for per-image styling: ![alt](url?w=360 '{"className":"..."}').
 */

/**
 * Transform markdown images to PopImage components.
 * Alt text appears as caption below the image.
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''

  // Standalone images: ![alt](url) or ![alt](url "title")
  const standaloneImage = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  const result = md.replace(standaloneImage, (_, alt, url) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" />`
  })

  return result
}
