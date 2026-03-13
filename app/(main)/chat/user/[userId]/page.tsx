'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx'
import { User, MessageSquare, ArrowLeft } from 'lucide-react'
import { ErrorBoundary, SuspenseLoader } from '@client'

interface UserInfo {
    id: number
    username: string
    email?: string
    full_name?: string
}

interface UserPost {
    id: number
    user_id: number
    channel_id: number
    channel_name: string
    created: string
    content: string
    username?: string
}

interface UserProfileData {
    user: UserInfo
    recentPosts: UserPost[]
}

function formatPostTime(created: string): string {
    const d = new Date(created)
    const now = new Date()
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (isToday) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const ChannelMarkdownOptions: MarkdownToJSX.Options = {
    overrides: {
        p: { component: 'div' },
        h1: { component: 'div' },
        h2: { component: 'div' },
    },
}

export default function ChatUserPage() {
    const params = useParams()
    const userId = params?.userId as string | undefined
    const [data, setData] = useState<UserProfileData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) return
        setLoading(true)
        setError(null)
        fetch(`/api/chat/getUserInfo?userId=${encodeURIComponent(userId)}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.error) {
                    setError(json.error)
                } else {
                    setData(json)
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [userId])

    if (!userId) {
        return (
            <div className="text-slate-500">Invalid user</div>
        )
    }

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                <SuspenseLoader />
                <p className="animate-pulse">Loading user...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col gap-4 py-8">
                <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                >
                    <ArrowLeft size={16} />
                    Back to Chat
                </Link>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500">
                    {error || 'User not found'}
                </div>
            </div>
        )
    }

    const { user, recentPosts } = data

    const channels = Array.from(new Set(recentPosts.map((p) => p.channel_name)))

    return (
        <ErrorBoundary assetName="ChatUserProfile">
            <article className="flex flex-col gap-6">
                <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium w-fit"
                >
                    <ArrowLeft size={16} />
                    Back to Chat
                </Link>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-xl text-white">
                            <User size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                {user.username}
                            </h1>
                            {user.full_name && (
                                <p className="text-sm text-slate-500">{user.full_name}</p>
                            )}
                            {user.email && (
                                <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                            )}
                        </div>
                    </div>

                    {channels.length > 0 && (
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Channels
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {channels.map((ch) => (
                                    <Link
                                        key={ch}
                                        href={`/chat?channel=${encodeURIComponent(ch)}`}
                                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        {ch}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="px-6 py-4">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MessageSquare size={16} />
                            Recent messages ({recentPosts.length})
                        </h2>
                        <div className="space-y-4">
                            {recentPosts.map((post) => (
                                <div
                                    key={post.id}
                                    className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800"
                                >
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        <Link
                                            href={`/chat?channel=${encodeURIComponent(post.channel_name)}`}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            #{post.channel_name}
                                        </Link>
                                        <span className="font-mono">
                                            {formatPostTime(post.created)}
                                        </span>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-0 text-slate-700 dark:text-slate-300">
                                        <Markdown options={ChannelMarkdownOptions}>
                                            {typeof post.content === 'string' ? post.content : ''}
                                        </Markdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </article>
        </ErrorBoundary>
    )
}
