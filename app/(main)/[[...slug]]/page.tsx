import React, { Suspense } from 'react'
import { fetchArticle } from '@/lib/articleServer'
import { ArticleContentSSR } from '@/components/ArticleContentSSR'
import { ArticleClientShell } from '@/components/ArticleClientShell'
import { CatchAllClient } from './CatchAllClient'
import { SuspenseLoader } from '@client'
import type { Metadata } from 'next'

interface PageProps {
  params: { slug?: string | string[] }
}

function getPathFromParams (params: { slug?: string | string[] }): string {
  if (!params.slug) return ''
  const slug = params.slug
  return Array.isArray(slug) ? slug.join('/') : slug
}

export async function generateMetadata ({ params }: PageProps): Promise<Metadata> {
  const path = getPathFromParams(params)
  if (!path) return { title: 'Paradigm Threat' }

  const article = await fetchArticle(path)
  if (!article) return { title: 'Paradigm Threat' }

  return {
    title: `${article.title} | Paradigm Threat`,
    description: (article.frontmatter.description as string) || `Read ${article.title} on Paradigm Threat`
  }
}

export default async function CatchAllPage ({ params }: PageProps) {
  const path = getPathFromParams(params)

  // Try to fetch article server-side for SSR (crawlers get full HTML)
  const article = path ? await fetchArticle(path) : null

  if (article) {
    return (
      <ArticleClientShell
        articleTitle={article.title}
        articleContent={article.mdxSource}
        basePath={article.basePath}
      >
        <Suspense fallback={<div className="animate-pulse h-32 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />}>
          <ArticleContentSSR mdxSource={article.mdxSource} basePath={article.basePath} />
        </Suspense>
      </ArticleClientShell>
    )
  }

  // Directory listing or 404: use client-side logic (requires fileList)
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><SuspenseLoader /></div>}>
      <CatchAllClient />
    </Suspense>
  )
}
