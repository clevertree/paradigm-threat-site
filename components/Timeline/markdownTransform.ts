/**
 * Transforms standalone markdown images into PopImage components.
 * Handles: ![alt](url) -> <PopImage src="url" alt="alt" className="..." />
 * Captions (*italic text* after image) are left as regular markdown.
 */

const DEFAULT_IMAGE_CLASS =
  'sm:float-left clear-left m-auto sm:m-1 sm:mr-6 sm:max-w-sm'

/**
 * Transform markdown images to PopImage components.
 * Only standalone images are converted; any caption text below remains as markdown.
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''

  // Standalone images: ![alt](url) or ![alt](url "title")
  const standaloneImage = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  const result = md.replace(standaloneImage, (_, alt, url) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" className="${DEFAULT_IMAGE_CLASS}" />`
  })

  return result
}

export { DEFAULT_IMAGE_CLASS }
