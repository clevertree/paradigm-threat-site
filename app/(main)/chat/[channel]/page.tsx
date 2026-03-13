'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChatRoom } from '@client'

export default function ChatChannelPage() {
    const params = useParams()
    const channel = params?.channel as string | undefined

    if (!channel) {
        return null
    }

    return <ChatRoom mode="full" channel={channel} />
}
