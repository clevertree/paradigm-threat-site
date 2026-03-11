'use client'

import React, { useMemo, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFiles } from '@/components'

/** Flatten file tree into ordered article paths (depth-first, matching left nav index). */
export function flattenArticlePaths(tree: Record<string, unknown> | null, prefix = ''): { path: string; title: string }[] {
    if (!tree || typeof tree !== 'object') return []
    const result: { path: string; title: string }[] = []
    const keys = Object.keys(tree).filter(k => k !== '_count' && k !== '_version').sort()

    for (const key of keys) {
        const val = tree[key]
        const fullPath = prefix ? `${prefix}/${key}` : key

        if (val !== null && typeof val === 'object' && '_count' in (val as object)) {
            const sub = val as Record<string, unknown>
            if (sub['page.md'] !== undefined || sub['page.mdx'] !== undefined) {
                const title = (sub['_title'] as string) || key.replace(/_/g, ' ')
                result.push({ path: fullPath, title })
            }
            result.push(...flattenArticlePaths(sub, fullPath))
        } else if (typeof val === 'object' && key.endsWith('.md') && !key.endsWith('.auto.md')) {
            if (key !== 'page.md' && key !== 'page.mdx') {
                const baseName = key.replace(/\.(md|mdx)$/, '')
                const articlePath = prefix ? `${prefix}/${baseName}` : baseName
                const title = (val as Record<string, unknown>)?._title as string | undefined
                result.push({ path: articlePath, title: title || baseName.replace(/_/g, ' ') })
            }
        }
    }
    return result
}

export function useArticleNav() {
    const pathname = usePathname()
    const { fileList } = useFiles()
    return useMemo(() => {
        if (!fileList || pathname.startsWith('/timeline')) return { prev: null, next: null }
        const articles = flattenArticlePaths(fileList)
        let currentPath = pathname === '/' ? '' : pathname.slice(1).replace(/\/$/, '')
        currentPath = currentPath.replace(/\.(md|mdx)$/, '') // match both /foo and /foo.md
        const idx = articles.findIndex(a => a.path === currentPath)
        if (idx < 0) return { prev: null, next: null }
        return {
            prev: idx > 0 ? articles[idx - 1] : null,
            next: idx < articles.length - 1 ? articles[idx + 1] : null,
        }
    }, [fileList, pathname])
}

const ArticleNav = memo(function ArticleNav() {
    const { prev, next } = useArticleNav()
    if (!prev && !next) return null

    return (
        <nav className="flex flex-wrap items-center justify-between gap-2 py-2 text-base text-slate-600 dark:text-slate-400">
            {prev ? (
                <Link href={`/${prev.path}`} className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[50%]" title={prev.title}>
                    ← {prev.title}
                </Link>
            ) : (
                <span />
            )}
            {next ? (
                <Link href={`/${next.path}`} className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[50%] ml-auto text-right" title={next.title}>
                    {next.title} →
                </Link>
            ) : (
                <span />
            )}
        </nav>
    )
})

export default ArticleNav
