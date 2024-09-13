'use client'

import React, {useEffect, useState} from 'react'

import styles from './ChatRoom.module.scss'
import {ErrorBoundary} from '@client'
import Markdown from 'markdown-to-jsx'

const API_URL = process.env.NEXT_PUBLIC_API

interface ChatRoomProps {
    channel: string,
    title?: string,
    className?: string,
    mode: 'full' | undefined
}

interface ChannelPost {
    id: number,
    user_id: number,
    username: string,
    channel_id: number,
    created: Date,
    content: string
}

interface ChannelContent {
    channel: string,
    posts: Array<ChannelPost>
}

interface ChannelInfo {
    id: number
    name: string,
    description: string,
}

interface ChannelList extends Array<ChannelInfo> {
}

interface FormElements extends HTMLFormControlsCollection {
    content: HTMLInputElement
}

export default function ChatRoom({channel, title, className, mode}: ChatRoomProps) {
    const [channelContent, setChannelContent] = useState<ChannelContent | null>()
    const [channelList, setChannelList] = useState<ChannelList>([])
    const [disabled, setDisabled] = useState<boolean>(false)
    const [error, setError] = useState<string | null>()
    const [postCount, setPostCount] = useState<number>(0)
    const [currentChannelName, setCurrentChannelName] = useState<string>(channel)

    useEffect(() => {
        if (currentChannelName) {
            // Fetch top directory
            fetch(`${API_URL}/api/chat/channel/${currentChannelName}/getPosts?postCount=${postCount}`)
                .then(res => res.json())
                .then((channelContent) => {
                    if (channelContent.error) {
                        setError(JSON.stringify(channelContent.error))
                    } else {
                        channelContent.posts = channelContent.posts.slice(0).reverse()
                        setChannelContent(channelContent)
                    }
                }).catch(error => {
                console.error(error)
                setError(error.message)
            })
        }
    }, [currentChannelName, postCount])

    useEffect(() => {
        // Fetch channel list
        if (mode === "full") {
            fetch(`${API_URL}/api/chat/getChannels`)
                .then(res => res.json())
                .then((channelList) => {
                    if (channelList.error) {
                        setError(JSON.stringify(channelList.error))
                    } else {
                        if (!currentChannelName) {
                            const randomChannel = channelList[Math.floor(Math.random() * channelList.length)].name;
                            setCurrentChannelName(randomChannel)
                        }
                        setChannelList(channelList)
                    }
                }).catch(error => {
                console.error(error)
                setError(error.message)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])

    async function onKeyDown(event: React.KeyboardEvent) {
        if (event.key === 'Enter' && event.ctrlKey) {
            // event.target.form.submit();
            await submitForm(event.target as HTMLFormElement);
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLElement>) {
        event.preventDefault()
        await submitForm(event.target as HTMLFormElement);
    }


    async function submitForm(formElm: HTMLFormElement) {
        try {
            const formData = new FormData(formElm)
            const formDataObject = Object.fromEntries(formData.entries())
            if (!formDataObject.username) {
                formDataObject.username = 'guest'
            }
            const {content: contentElm} = (formElm.elements as FormElements)
            contentElm.value = ''
            setDisabled(true)
            const response = await fetch(`${API_URL}/api/chat/channel/${currentChannelName}/createGuestPost`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                method: 'POST',
                body: JSON.stringify(formDataObject)
            })
            setDisabled(false)
            setPostCount(postCount + 1);
        } catch (error) {
            if (error instanceof Error) {
                const errorMessage = `Error submitting message: ${error.message}`
                console.error(error)
                setError(errorMessage)
            }
        }
    }

    let channelSelectionMarkup = null;
    if (mode === 'full') {
        channelSelectionMarkup = (
            <select
                size={4}
                value={currentChannelName}
                onChange={e => {
                    setCurrentChannelName(e.target.value)
                    setChannelContent(null)
                }}
                className='overflow-y-auto h-full  text-sm'>
                {channelList.map((c) => (
                    <option key={c.name}
                    >{c.name}</option>
                ))}
            </select>
        )
    }

    let renderedMarkup = (
        <div className={`${styles.container} ${className || ''}`}>
            <div className={styles.channelTitle}>
                {title || `Channel: ${currentChannelName}`}
            </div>
            <div className='flex flex-col sm:flex-row h-[80vh]'>
                {channelSelectionMarkup}
                <div className={styles.channel + ' sm:w-[80%] flex-grow overflow-y-auto'}>
                    {channelContent?.posts?.map(({username, content, created}, index) => (
                        <div key={index} className={styles.post}
                             title={`Created at ${new Date(created).toLocaleString()}`}>
                            <span className={styles.username}>{username}</span>
                            <span className={styles.content}><Markdown>{content}</Markdown></span>
                        </div>
                    ))}
                    {error &&
                      <div className={`${styles.post} ${styles.error}`}>Could not load chatroom: {error}</div>}
                </div>
            </div>
            <div>
                <form onSubmit={onSubmit}>
                    <fieldset disabled={disabled} className="flex">
                        <input
                            type="text" name="username" className={`${styles.input} w-24 text-center italic`}
                            placeholder="guest" title="Type your guest name here"
                        />
                        <input
                            type="text"
                            name="content"
                            className={`${styles.input} w-full`}
                            onKeyDown={onKeyDown}
                            required
                            title="Send a message to the channel"
                            placeholder="got something to say? type it here and hit the enter key to send to the channel"
                        />
                        <button
                            type="submit" className={`${styles.input} ${styles.submit} w-24`} value="Submit"
                        >Send
                        </button>
                    </fieldset>
                </form>
            </div>
            {/*<div className={styles.channelFooter}>*/}
            {/*  <a*/}
            {/*    href={`https://chat.paradigmthreat.net/paradigm-threat/channels/${channel}`} target=" _blank"*/}
            {/*    rel="noreferrer"*/}
            {/*  >*/}
            {/*    Visit {title || channel} in new window*/}
            {/*  </a>*/}
            {/*</div>*/}
        </div>
    );

    return (
        <ErrorBoundary assetName="ChatRoom">
            {renderedMarkup}
        </ErrorBoundary>
    )
}
