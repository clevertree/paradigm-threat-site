'use client'

import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MarkdownLink } from '@/components/MarkdownLink'
import { useTimelineLink } from '@/components/Timeline/TimelineLinkContext'

/**
 * For timeline event links: uses in-app callback so selection and URL update without
 * full page refresh, preserving fullscreen and view mode. Otherwise same as MarkdownLink
 * and preserves current search params for /timeline/* so navigation keeps fullscreen.
 */
export function TimelineAwareLink({
  href,
  children,
  ...props
}: {
  href?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const searchParams = useSearchParams()
  const { onTimelineNavigate } = useTimelineLink()

  const isTimelineInternal =
    typeof href === 'string' && href.startsWith('/timeline') && !href.startsWith('http')
  const pathOnly = typeof href === 'string' ? href.split('?')[0] : ''
  const eventId =
    isTimelineInternal && pathOnly
      ? decodeURIComponent(pathOnly.replace(/^\/timeline\/?/, '').trim())
      : ''
  const preservedHref =
    isTimelineInternal && href
      ? `${pathOnly}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      : href

  // In-app navigation: update selection + URL without full page load
  if (eventId && onTimelineNavigate && typeof preservedHref === 'string') {
    return (
      <Link
        href={preservedHref}
        onClick={(e) => {
          e.preventDefault()
          onTimelineNavigate(eventId)
        }}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </Link>
    )
  }

  return (
    <MarkdownLink href={preservedHref} {...props}>
      {children}
    </MarkdownLink>
  )
}
