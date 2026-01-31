/**
 * Transforms markdown image + caption patterns into PopImage components.
 * Handles: ![alt](url)\n*caption* and standalone ![alt](url)
 */

const DEFAULT_IMAGE_CLASS =
  'sm:float-left clear-left m-auto sm:m-1 sm:mr-6 sm:max-w-sm'

/**
 * Transform markdown so that:
 * 1. ![alt](url)\n*caption* becomes <PopImage src="url" alt="alt" className="...">caption</PopImage>
 * 2. Standalone ![alt](url) becomes <PopImage src="url" alt="alt" className="..." />
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''
  // Pattern 1: image followed by italic caption (single line)
  // ![alt](url) or ![alt](url "title") followed by \n*caption*
  const imageWithCaption = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\s*\n\*([^\n]*)\*/g

  let result = md.replace(imageWithCaption, (_, alt, url, caption) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeCaption = typeof caption === 'string' ? caption.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" className="${DEFAULT_IMAGE_CLASS}">${safeCaption}</PopImage>`
  })

  // Pattern 2: standalone images (no caption)
  const standaloneImage = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  result = result.replace(standaloneImage, (_, alt, url) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" className="${DEFAULT_IMAGE_CLASS}" />`
  })

  return result
}

export { DEFAULT_IMAGE_CLASS }
