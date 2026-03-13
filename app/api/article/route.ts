import { NextRequest, NextResponse } from 'next/server'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import rehypeUnwrapImages from 'rehype-unwrap-images'
import remarkGfm from 'remark-gfm'
import rehypeUnwrapFigures from '@/lib/rehypeUnwrapFigures'

const FILES_BASE_URL =
  process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files'

/**
 * Fetch a remote MD/MDX file and return it compiled.
 * GET /api/article?path=influence/stolen_credit/nintendo-sony-breakup.md&v=...
 */
export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get('path') ?? ''
    const v = req.nextUrl.searchParams.get('v')
    const vParam = v ? `?v=${v}` : ''

    let targetPath = ''
    let fileContent: string | null = null

    // 1. Try direct .md/.mdx
    if (path.endsWith('.md') || path.endsWith('.mdx')) {
      const res = await fetch(`${FILES_BASE_URL}/${path}${vParam}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        fileContent = await res.text()
        targetPath = path
      }
    }

    // 2. Try path.md then path.mdx (extension omitted in URL)
    if (!fileContent && path && !path.endsWith('.md') && !path.endsWith('.mdx')) {
      for (const ext of ['.md', '.mdx']) {
        const p = `${path}${ext}`
        const res = await fetch(`${FILES_BASE_URL}/${p}${vParam}`, {
          cache: 'no-store',
        })
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
        const res = await fetch(`${FILES_BASE_URL}/${p}${vParam}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          fileContent = await res.text()
          targetPath = p
          break
        }
      }
    }

    if (!fileContent) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { content: rawContent, data: frontMatter } = matter(fileContent)
    // Convert <https://...> and <http://...> autolinks to [url](url) — MDX treats < as JSX
    const mdxSource = rawContent.replace(/<(https?:\/\/[^>]+)>/g, (_, url) => `[${url}](${url})`)
    const basePath = targetPath.includes('/')
      ? targetPath.split('/').slice(0, -1).join('/')
      : ''
    const titleFromPath = basePath
      ? basePath.split('/').pop()?.replace(/_/g, ' ')
      : 'Article'
    const title = (frontMatter?.title as string) || titleFromPath || 'Article'

    const { compiledSource, frontmatter, scope } = await serialize(mdxSource, {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeUnwrapImages, rehypeUnwrapFigures],
      },
    })

    return NextResponse.json({
      compiledSource,
      frontmatter,
      scope,
      content: mdxSource,
      title,
      basePath,
    })
  } catch (err) {
    console.error('[api/article]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load article' },
      { status: 500 }
    )
  }
}
