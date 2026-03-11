/**
 * Server Component: renders MDX article content for SSR/crawling.
 * Uses next-mdx-remote/rsc compileMDX - no client fetch for crawlers.
 */

import React from 'react'
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import * as componentsNamespace from '@/components'
import { MarkdownLink } from './MarkdownLink'

const {
  PopImage,
  OptimizedImage,
  ChatRoom,
  ChangeLog,
  DynamicIndex,
  DynamicNav,
  EmbedFile,
  ThemeToggle,
  Navbar
} = componentsNamespace

function mdxComponents (basePath: string): Record<string, React.ComponentType<any>> {
  return {
    PopImage: (props: any) => <PopImage {...props} basePath={basePath} />,
    OptimizedImage: (props: any) => <OptimizedImage {...props} basePath={basePath} />,
    ChatRoom,
    ChangeLog,
    DynamicIndex: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    DynamicNav: (props: any) => <DynamicNav {...props} currentPath={basePath} />,
    EmbedFile: (props: any) => {
      let src = props.src
      if (src?.startsWith('./')) {
        const path = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : ''
        src = path + src.slice(2)
      } else if (src && !src.startsWith('/') && !src.startsWith('http')) {
        const path = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : ''
        src = path + src
      }
      return <EmbedFile {...props} src={src} currentPath={basePath} />
    },
    img: (props: any) => <PopImage {...props} basePath={basePath} />,
    AutoContent: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    Auto: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    a: (props: any) => {
      let href = props.href || ''
      if (href && !href.startsWith('/') && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        href = basePath ? `/${basePath}/${href}` : `/${href}`
      }
      return <MarkdownLink {...props} href={href} />
    }
  }
}

export interface ArticleContentSSRProps {
  mdxSource: string
  basePath: string
}

export async function ArticleContentSSR ({ mdxSource, basePath }: ArticleContentSSRProps) {
  const { content } = await compileMDX({
    source: mdxSource,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm] }
    },
    components: mdxComponents(basePath)
  })

  return (
    <div className="mdx-content">
      {content}
    </div>
  )
}
