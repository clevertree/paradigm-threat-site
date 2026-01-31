/**
 * Transforms markdown image + caption patterns into PopImage components.
 * Handles: ![alt](url)\n*caption* (single italic phrase only) and standalone ![alt](url)
 * Caption is restricted to one *...* phrase so link syntax [text](url) and extra * never
 * appear inside the tag and break the parser.
 */

const DEFAULT_IMAGE_CLASS =
  'sm:float-left clear-left m-auto sm:m-1 sm:mr-6 sm:max-w-sm'

function escapeCaption(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Transform markdown so that:
 * 1. ![alt](url)\n*caption* (single italic phrase) becomes <PopImage ...>caption</PopImage>; rest of line stays as markdown
 * 2. Standalone ![alt](url) becomes <PopImage src="url" alt="alt" className="..." />
 */
export function transformImageCaptions(md: string): string {
  if (typeof md !== 'string') return ''
  // Pattern 1: image followed by a single italic phrase (no * inside caption) so we never capture [link](url) or second *...*
  const imageWithCaption = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\s*\n\*([^*]+)\*/g

  let result = md.replace(imageWithCaption, (_, alt, url, caption) => {
    const safeAlt = typeof alt === 'string' ? alt.replace(/"/g, '&quot;') : ''
    const safeCaption = typeof caption === 'string' ? escapeCaption(caption.trim()) : ''
    const safeUrl = typeof url === 'string' ? url : ''
    return `<PopImage src="${safeUrl}" alt="${safeAlt}" className="${DEFAULT_IMAGE_CLASS}">${safeCaption}</PopImage>\n`
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
