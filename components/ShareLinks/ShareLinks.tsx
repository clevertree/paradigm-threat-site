'use client'

import React from 'react'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://paradigmthreat.net'

/** Max chars for Twitter/X text param (URL counts toward limit when combined) */
const TWITTER_TEXT_MAX = 200
/** Bluesky compose has 300 char limit */
const BLUESKY_MAX_CHARS = 300

export interface ShareLinksProps {
  url: string
  title: string
  description?: string
}

function buildAbsoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  const base = SITE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function buildShareHrefs(
  url: string,
  title: string,
  description?: string
): { platform: string; href: string }[] {
  const absUrl = buildAbsoluteUrl(url)
  const encodedUrl = encodeURIComponent(absUrl)

  const text = description ? `${title} — ${description}` : title
  const truncatedText = text.length > TWITTER_TEXT_MAX ? text.slice(0, TWITTER_TEXT_MAX - 3) + '...' : text
  const encodedText = encodeURIComponent(truncatedText)

  // Bluesky only has 'text' param — must include URL in the body (300 char limit)
  const bskyMaxTitle = Math.max(0, BLUESKY_MAX_CHARS - absUrl.length - 2)
  const bskyText = `${text.length > bskyMaxTitle ? text.slice(0, bskyMaxTitle - 3) + '...' : text}\n${absUrl}`
  const encodedBskyText = encodeURIComponent(bskyText)

  return [
    {
      platform: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    },
    {
      platform: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    },
    {
      platform: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    {
      platform: 'Reddit',
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(title)}`
    },
    {
      platform: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${encodedBskyText}`
    }
  ]
}

export function ShareLinks({ url, title, description }: ShareLinksProps) {
  const links = buildShareHrefs(url, title, description)

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Share</p>
      <div className="flex flex-wrap gap-2">
        {links.map(({ platform, href }) => (
          <a
            key={platform}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {platform}
          </a>
        ))}
      </div>
    </div>
  )
}
