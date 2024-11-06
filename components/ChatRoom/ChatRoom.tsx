'use client'

import React, {useEffect, useState} from 'react'

import styles from './ChatRoom.module.scss'
import {ErrorBoundary, SuspenseLoader} from '@client'
import Markdown, {MarkdownToJSX} from 'markdown-to-jsx'
import debug from "debug";

const API_URL = process.env.NEXT_PUBLIC_API

interface ChatRoomProps {
    channel: string,
    title?: string,
    className?: string,
    mode?: 'full'
}

interface ChannelEntry {
    id: number,
    user_id: number,
    username: string,
    channel_id: number,
    created: Date,
    content: string,
    isError?: true
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

interface FormElements extends HTMLFormControlsCollection {
    content: HTMLInputElement
}

export default function ChatRoom({channel, title, className, mode}: ChatRoomProps) {
    const [channelContent, setChannelContent] = useState<ChannelContent | null>()
    const [channelList, setChannelList] = useState<ChannelList>([])
    const [loading, setLoading] = useState(true)
    const [disabled, setDisabled] = useState<boolean>(false)
    // const [error, setError] = useState<string | null>()
    const [postCount, setPostCount] = useState<number>(0)
    const [currentChannelName, setCurrentChannelName] = useState<string>(channel)
    const [currentUserName, setCurrentUserName] = useState<string>('')

    function addError(error:string) {
        setChannelContent(channelContent => {
            const newContent = channelContent ? {...channelContent} : {posts: []}
            const newEntry: ChannelEntry = {
                username: 'system',
                id: -1,
                user_id: -1,
                channel_id: -1,
                created: new Date(),
                content: error,
                isError: true
            }
            newContent.posts = [newEntry, ...newContent.posts]
            return newContent as ChannelContent
        })
    }

    useEffect(() => {
        const username = localStorage.getItem('ChatRoom:username');
        if (username)
            setCurrentUserName(username);
    }, [])

    useEffect(() => {
        if (currentChannelName) {
            // Fetch top directory
            setLoading(true);
            fetch(`${API_URL}/api/chat/channel/${currentChannelName}/getPosts?postCount=${postCount}`)
                .then(res => res.json())
                .then((channelContent) => {
                    if (channelContent.error) {
                        addError(JSON.stringify(channelContent.error))
                    } else {
                        // channelContent.posts = channelContent.posts.slice(0).reverse()
                        setChannelContent(channelContent)
                    }
                })
                .catch(error => {
                    console.error(error)
                    addError(error.message)
                }).finally(() => {
                    setLoading(false);
                })
        }
    }, [currentChannelName, postCount])

    useEffect(() => {
        // Fetch channel list
        setLoading(true);
        if (mode === "full") {
            fetch(`${API_URL}/api/chat/getChannels`)
                .then(res => res.json())
                .then((channelList) => {
                    if (channelList.error) {
                        addError(JSON.stringify(channelList.error))
                    } else {
                        if (!currentChannelName) {
                            const randomChannel = channelList[Math.floor(Math.random() * channelList.length)].name;
                            setCurrentChannelName(randomChannel)
                        }
                        setChannelList(channelList)
                    }
                }).catch(error => {
                console.error(error)
                addError(error.message)
            }).finally(() => {
                setLoading(false);
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
            const formData = new FormData(formElm)
            const formDataObject = Object.fromEntries(formData.entries()) as { [key: string]: string }
            if (!formDataObject?.username) {
                formDataObject.username = 'guest'
            } else {
                localStorage.setItem("ChatRoom:username", formDataObject.username);
            }
            const {content: contentElm} = (formElm.elements as FormElements)
            contentElm.value = ''
            setDisabled(true)
            fetch(`${API_URL}/api/chat/channel/${currentChannelName}/createGuestPost`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                method: 'POST',
                body: JSON.stringify(formDataObject)
            })
                .then((response) => {
                    if(!response.ok) {
                        response.json().then(json => {
                            addError(`HTTP error! status: ${response.status}, message: ${JSON.stringify(json?.error?.message || json?.error || json)}`);
                        });
                    } else {
                        setPostCount(postCount + 1);
                    }
                })
                .catch(error => {
                    console.error(error)
                    addError(`Error submitting message: ${error.message} (`)
                })
                .finally(() => {
                    setDisabled(false)

                })
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

    // TODO: Shadow DOM?
    let renderedMarkup = (
        <div className={`${styles.container} ${className || ''}`}>
            {loading ? <SuspenseLoader/> : null}
            <div className={styles.channelTitle}>
                {title || loading ? "Loading..." : `Channel '${currentChannelName}'`}
            </div>
            <div className='flex flex-col sm:flex-row sm:h-[60vh]'>
                {channelSelectionMarkup}
                <div className={styles.channel + ' max-h-[80vh] sm:w-[80%] flex-grow overflow-y-auto'}>
                    {channelContent?.posts?.map(({username, content, created, isError}, index) => (
                        <div key={index} className={styles.post + (isError ? ' ' + styles.error : '')}
                             title={`Created at ${new Date(created).toLocaleString()}`}>
                            <span className={styles.username}>{username}</span>
                            <span className={styles.content}>
                                <Markdown options={ChannelMarkdownOptions}>
                                    {content}
                                </Markdown>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <form onSubmit={onSubmit}>
                    <fieldset disabled={disabled || loading} className="flex">
                        <input
                            type="text" name="username"
                            className={`${styles.input} w-24 text-center italic`}
                            defaultValue={currentUserName}
                            placeholder="guest"
                            title="Type your guest name here"
                        />
                        <input
                            type="text"
                            name="content"
                            className={`${styles.input} w-full`}
                            onKeyDown={onKeyDown}
                            required
                            maxLength={1024}
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


const ChannelMarkdownOptions: MarkdownToJSX.Options = {
    overrides: {
        p: {
            component: 'div'
        }
    }
}
