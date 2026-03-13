'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ErrorBoundary, SuspenseLoader } from '@client'
import Markdown, { MarkdownToJSX } from 'markdown-to-jsx'
import { Send, User, MessageSquare, AlertCircle, RefreshCcw, Maximize2, Minimize2 } from 'lucide-react'

interface ChatRoomProps {
    channel?: string,
    title?: string,
    className?: string,
    mode?: 'full'
}

interface ChannelEntry {
    id: number,
    user_id?: number,
    username: string,
    created: string,
    content: string,
    isError?: boolean
}

interface ChannelContent {
    channel: string,
    posts: Array<ChannelEntry>
}

interface ChannelInfo {
    id: number
    name: string,
    description: string,
}

interface ChannelList extends Array<ChannelInfo> {
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

import { CHAT_FULL_PREFIX, getChatBasePath } from '@/lib/chatPaths'

function getChannelFromPath(pathname: string | null): string | null {
    if (!pathname) return null
    const segments = pathname.split('/').filter(Boolean)
    if (segments[0] !== 'chat') return null
    const offset = segments[1] === 'full' ? 2 : 1
    const segment = segments[offset]
    if (segment && segment !== 'recent' && segment !== 'user') return segment
    return null
}

export default function ChatRoom({ channel: channelProp, title, className, mode }: ChatRoomProps) {
    const pathname = usePathname()
    const router = useRouter()
    const channelFromPath = getChannelFromPath(pathname)
    const [channelContent, setChannelContent] = useState<ChannelContent | null>(null)
    const [channelList, setChannelList] = useState<ChannelList>([])
    const [loading, setLoading] = useState(true)
    const [disabled, setDisabled] = useState<boolean>(false)
    const [postCount, setPostCount] = useState<number>(0)
    const [currentChannelName, setCurrentChannelName] = useState<string>(channelFromPath || channelProp || '')
    const [currentUserName, setCurrentUserName] = useState<string>('')

    const basePath = getChatBasePath(pathname)
    const isExpanded = pathname?.startsWith(CHAT_FULL_PREFIX) ?? false

    const addError = useCallback((error: string) => {
        setChannelContent(prev => {
            const newEntry: ChannelEntry = {
                username: 'system',
                id: -1,
                created: new Date().toISOString(),
                content: error,
                isError: true
            }
            return {
                channel: currentChannelName,
                posts: [newEntry, ...(prev?.posts || [])]
            }
        })
    }, [currentChannelName])

    useEffect(() => {
        const username = localStorage.getItem('ChatRoom:username');
        if (username) setCurrentUserName(username);
    }, [])

    const fetchPosts = useCallback(() => {
        if (!currentChannelName) return;
        setLoading(true);
        fetch(`/api/chat/getPosts?channel=${encodeURIComponent(currentChannelName)}&limit=50`)
            .then(res => res.json())
            .then((data) => {
                if (data.error) {
                    addError(data.error)
                } else {
                    setChannelContent(data)
                }
            })
            .catch(error => {
                console.error(error)
                addError(error.message)
            }).finally(() => {
                setLoading(false);
            })
    }, [currentChannelName, addError])

    useEffect(() => {
        fetchPosts()
    }, [fetchPosts, postCount])

    useEffect(() => {
        if (channelFromPath && channelFromPath !== currentChannelName) {
            setCurrentChannelName(channelFromPath)
            setChannelContent(null)
        }
    }, [channelFromPath])

    useEffect(() => {
        if (mode === "full") {
            setLoading(true);
            fetch(`/api/chat/getChannels`)
                .then(res => res.json())
                .then((data: ChannelInfo[] | { error: string }) => {
                    if (data && 'error' in data) {
                        addError(data.error)
                    } else {
                        const channels = data as ChannelInfo[]
                        setChannelList(channels)
                        if (channels.length > 0) {
                            const validFromPath = channelFromPath && channels.some((c) => c.name === channelFromPath)
                            setCurrentChannelName((prev) =>
                                validFromPath ? channelFromPath : (prev && channels.some((c) => c.name === prev) ? prev : channels[0].name)
                            )
                            if (!validFromPath && !channelFromPath && pathname?.startsWith('/chat')) {
                                const redirectBase = pathname.startsWith(CHAT_FULL_PREFIX) ? CHAT_FULL_PREFIX : '/chat'
                                router.replace(`${redirectBase}/${encodeURIComponent(channels[0].name)}`)
                            }
                        }
                    }
                }).catch(error => {
                    console.error(error)
                    addError(error.message)
                }).finally(() => {
                    setLoading(false);
                })
        }
    }, [mode, channelFromPath, pathname, router, addError])

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const username = formData.get('username') as string || 'guest'
        const content = formData.get('content') as string

        if (!content.trim()) return

        localStorage.setItem("ChatRoom:username", username);
        setDisabled(true)

        try {
            const res = await fetch(`/api/chat/createGuestPost`, {
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
                body: JSON.stringify({ username, content, channel: currentChannelName })
            })

            const json = await res.json()
            if (!res.ok) {
                throw new Error(json.error || 'Failed to post message')
            }

            const post = json as { id: number; user_id: number; created: string; content: string }
            const newEntry: ChannelEntry = {
                id: post.id,
                user_id: post.user_id,
                username,
                created: post.created,
                content: post.content,
            }
            setChannelContent((prev) =>
                prev
                    ? { ...prev, posts: [newEntry, ...prev.posts] }
                    : { channel: currentChannelName, posts: [newEntry] }
            )

            form.reset()
            setPostCount(prev => prev + 1)
        } catch (error: any) {
            addError(error.message)
        } finally {
            setDisabled(false)
        }
    }

    return (
        <ErrorBoundary assetName="ChatRoom">
            <div className={`flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl ${className || ''} ${isExpanded ? 'fixed inset-0 z-[110] min-h-0' : 'h-[70vh]'} select-none`}>
                {/* Copy Placeholder - invisible but selectable */}
                <span className="absolute opacity-0 pointer-events-none select-text">
                    [Paradigm Threat Live Chat: {title || currentChannelName}]
                </span>

                {/* Header */}
                <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white leading-none mb-1">
                                {title || `Channel: ${currentChannelName}`}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Public Repository Chat</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {mode === 'full' && (
                            <>
                            <Link
                                href={`${basePath}/recent`}
                                className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Recent
                            </Link>
                            <select
                                value={currentChannelName}
                                onChange={e => {
                                    const val = e.target.value
                                    setCurrentChannelName(val)
                                    setChannelContent(null)
                                    router.push(`${basePath}/${encodeURIComponent(val)}`)
                                }}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            >
                                {channelList.map((c) => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                            </>
                        )}
                        <button
                            onClick={() => {
                                const target = isExpanded ? `/chat/${encodeURIComponent(currentChannelName)}` : `${CHAT_FULL_PREFIX}/${encodeURIComponent(currentChannelName)}`
                                router.push(target)
                            }}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                            title={isExpanded ? 'Shrink' : 'Expand to fill window'}
                        >
                            {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button
                            onClick={() => setPostCount(prev => prev + 1)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                            title="Refresh messages"
                        >
                            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-6 space-y-4 scroll-smooth">
                    {loading && !channelContent && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                            <SuspenseLoader />
                            <p className="animate-pulse">Loading messages...</p>
                        </div>
                    )}

                    {channelContent?.posts?.map((post, index) => (
                        <div
                            key={post.id === -1 ? `err-${index}` : post.id}
                            className={`flex flex-col ${post.isError ? 'bg-red-500/10 border border-red-500/20 p-4 rounded-xl shadow-inner' : ''}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {post.user_id != null && !post.isError ? (
                                    <Link
                                        href={`${basePath}/user/${post.user_id}`}
                                        className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        {post.username}
                                    </Link>
                                ) : (
                                    <span className={`font-bold text-sm ${post.isError ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {post.username}
                                    </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {formatPostTime(post.created)}
                                </span>
                                {post.isError && <AlertCircle size={14} className="text-red-500" />}
                            </div>
                            <div className={`prose prose-sm dark:prose-invert max-w-none prose-p:mb-0 ${post.isError ? 'text-red-500 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                                <Markdown options={ChannelMarkdownOptions}>
                                    {typeof post.content === 'string' ? post.content : ''}
                                </Markdown>
                            </div>
                        </div>
                    ))}

                    {!loading && channelContent?.posts?.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 opacity-50">
                            <MessageSquare size={48} />
                            <p>No messages yet. Be the first to speak!</p>
                        </div>
                    )}
                </div>

                {/* Footer / Input */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    <form onSubmit={onSubmit} className="flex gap-2">
                        <div className="relative flex-shrink-0 group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                name="username"
                                defaultValue={currentUserName}
                                placeholder="guest"
                                disabled={disabled || loading}
                                className="pl-9 pr-3 py-2.5 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50 transition-all transition-all"
                            />
                        </div>
                        <div className="relative flex-grow group">
                            <input
                                type="text"
                                name="content"
                                placeholder="Write a message..."
                                required
                                disabled={disabled || loading}
                                autoComplete="off"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={disabled || loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center flex-shrink-0"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </ErrorBoundary>
    )
}

const ChannelMarkdownOptions: MarkdownToJSX.Options = {
    overrides: {
        p: { component: 'div' },
        h1: { component: 'div' },
        h2: { component: 'div' },
    }
}
