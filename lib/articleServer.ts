/**
 * Server-side article fetching for SSR/crawling.
 * Mirrors logic from app/api/article/route.ts.
 */

const FILES_BASE_URL =
  process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files'

export interface ArticleData {
  mdxSource: string
  targetPath: string
  title: string
  basePath: string
  frontmatter: Record<string, unknown>
}

export async function fetchArticle(path: string): Promise<ArticleData | null> {
  let targetPath = ''
  let fileContent: string | null = null

  // 1. Try direct .md/.mdx
  if (path.endsWith('.md') || path.endsWith('.mdx')) {
    const res = await fetch(`${FILES_BASE_URL}/${path}`, { cache: 'no-store' })
    if (res.ok) {
      fileContent = await res.text()
      targetPath = path
    }
  }

  // 2. Try path.md then path.mdx (extension omitted in URL)
  if (!fileContent && path && !path.endsWith('.md') && !path.endsWith('.mdx')) {
    for (const ext of ['.md', '.mdx']) {
      const p = `${path}${ext}`
      const res = await fetch(`${FILES_BASE_URL}/${p}`, { cache: 'no-store' })
      if (res.ok) {
        fileContent = await res.text()
        targetPath = p
        break
      }
    }
  }

  // 3. Try page.md then page.mdx (directory index)
  if (!fileContent) {
    const base = path ? `${path}/` : ''
    for (const name of ['page.md', 'page.mdx']) {
      const p = `${base}${name}`
      const res = await fetch(`${FILES_BASE_URL}/${p}`, { cache: 'no-store' })
      if (res.ok) {
        fileContent = await res.text()
        targetPath = p
        break
      }
    }
  }

  if (!fileContent) return null

  const matter = await import('gray-matter')
  const { content: rawContent, data: frontMatter } = matter.default(fileContent)
  const basePath = targetPath.includes('/')
    ? targetPath.split('/').slice(0, -1).join('/')
    : ''
  const titleFromPath = basePath
    ? basePath.split('/').pop()?.replace(/_/g, ' ')
    : 'Article'
  const title = (frontMatter?.title as string) || titleFromPath || 'Article'

  // Same autolink transform as API (MDX treats < as JSX)
  const mdxSource = rawContent.replace(/<(https?:\/\/[^>]+)>/g, (_, url) => `[${url}](${url})`)

  return {
    mdxSource,
    targetPath,
    title,
    basePath,
    frontmatter: frontMatter as Record<string, unknown>,
  }
}
