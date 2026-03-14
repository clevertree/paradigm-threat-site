import React from 'react'
import { TimelineEventClient } from '@/components/Timeline/TimelineEventClient'
import { getTimelineEventMeta } from '@/lib/timelineEventServer'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://paradigmthreat.net'

interface PageProps {
  params: Promise<{ eventId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params
  const meta = await getTimelineEventMeta(eventId)
  if (!meta) {
    return { title: 'Alternate Earth History Timeline | Paradigm Threat' }
  }

  const title = `${meta.title} | Paradigm Threat`
  const description = `Read "${meta.title}" on the Paradigm Threat alternate earth history timeline.`
  const canonicalUrl = `${SITE_URL.replace(/\/$/, '')}/timeline/${eventId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Paradigm Threat',
      ...(meta.ogImageUrl && { images: [{ url: meta.ogImageUrl }] })
    },
    twitter: {
      card: meta.ogImageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(meta.ogImageUrl && { images: [meta.ogImageUrl] })
    }
  }
}

export default async function TimelineEventPage({ params }: PageProps) {
  return <TimelineEventClient />
}
