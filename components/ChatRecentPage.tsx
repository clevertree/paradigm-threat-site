'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx'
import { MessageSquare, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { ErrorBoundary, SuspenseLoader } from '@client'
import { CHAT_FULL_PREFIX, getChatBasePath } from '@/lib/chatPaths'

interface RecentPost {
    id: number
    user_id: number
    channel_id: number
    channel_name: string
    created: string
    content: string
    username?: string
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

export default function ChatRecentPage() {
    const pathname = usePathname()
    const router = useRouter()
    const basePath = getChatBasePath(pathname)
    const isExpanded = pathname?.startsWith(`${CHAT_FULL_PREFIX}/recent`) ?? false

    const [posts, setPosts] = useState<RecentPost[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        setError(null)
        fetch('/api/chat/getRecentPosts?limit=50')
            .then((res) => res.json())
            .then((json) => {
                if (json.error) {
                    setError(json.error)
                } else {
                    setPosts(json.posts || [])
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading && posts.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center gap-4 text-slate-400 ${isExpanded ? 'fixed inset-0 z-[110] min-h-0' : 'py-16'}`}>
                <SuspenseLoader />
                <p className="animate-pulse">Loading messages...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col gap-4 py-8">
                <Link
                    href={basePath}
                    className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                >
                    <ArrowLeft size={16} />
                    Back to Chat
                </Link>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500">
                    {error}
                </div>
            </div>
        )
    }

    const content = (
        <ErrorBoundary assetName="ChatRecentMessages">
            <article className="flex flex-col gap-6 flex-1 min-h-0">
                <div className="flex items-center gap-4 flex-wrap">
                    <Link
                        href={basePath}
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium w-fit"
                    >
                        <ArrowLeft size={16} />
                        Back to Chat
                    </Link>
                    <button
                        onClick={() => router.push(isExpanded ? '/chat/recent' : `${CHAT_FULL_PREFIX}/recent`)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                        title={isExpanded ? 'Shrink' : 'Expand to fill window'}
                    >
                        {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                </div>

                <div className="flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-0">
                    <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-xl text-white">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                Recent messages
                            </h1>
                            <p className="text-sm text-slate-500">
                                Latest activity across all channels
                            </p>
                        </div>
                    </div>

                    <div className="px-6 py-4 overflow-y-auto flex-1">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MessageSquare size={16} />
                            Messages ({posts.length})
                        </h2>
                        <div className="space-y-4">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800"
                                >
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        <Link
                                            href={`${basePath}/${encodeURIComponent(post.channel_name)}`}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            #{post.channel_name}
                                        </Link>
                                        <span className="text-slate-400">·</span>
                                        <Link
                                            href={`${basePath}/user/${post.user_id}`}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            {post.username || 'unknown'}
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

                        {posts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 opacity-50">
                                <MessageSquare size={48} />
                                <p>No messages yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </article>
        </ErrorBoundary>
    )

    if (isExpanded) {
        return (
            <div className="fixed inset-0 z-[110] min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900 p-6 overflow-hidden select-none">
                {content}
            </div>
        )
    }

    return content
}
