'use client'

import React, { useEffect, useState } from 'react'
import Markdown from 'markdown-to-jsx'

import styles from './ChatRoom.module.scss'
import { ErrorBoundary } from '@client'

export default function ChatRoom ({ channel, title, className }) {
  const [channelInfo, setChannelInfo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch top directory
    fetch(`/api/chat/channel/${channel}/getPosts`)
      .then(res => res.json())
      .then((channelInfo) => {
        setChannelInfo(channelInfo)
      }).catch(error => {
        console.error(error.message)
        setError(error.message)
      })
  }, [channel])

  async function onKeyDown (event) {
    if (event.key === 'Enter' && event.ctrlKey) {
      // event.target.form.submit();
      await onSubmit(event)
    }
  }

  async function onSubmit (event) {
    event.preventDefault()

    const formElm = event.target.form || event.target
    const formData = new FormData(formElm)
    const formDataObject = Object.fromEntries(formData.entries())
    if (!formDataObject.username) { formDataObject.username = 'guest' }
    formElm.elements.message.value = ''
    formElm.elements.message.disabled = true
    const response = await fetch(`/api/chat/channel/${channel}/createGuestPost`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      method: 'POST',
      body: JSON.stringify(formDataObject)
    })

    const { message, username } = await response.json()
    setChannelInfo({
      ...channelInfo,
      posts: [
        ...channelInfo.posts,
        {
          username,
          message
        }
      ]
    })
    formElm.elements.message.disabled = false
  }

  return (
    <ErrorBoundary>
      <div className={`${styles.container} ${className}`}>
        <div className={styles.channelTitle}>
          <a
            href={`https://chat.paradigmthreat.net/paradigm-threat/channels/${channel}`} target=' _blank'
            rel='noreferrer'
          >
            {title || channel}
          </a>
        </div>
        <div className={styles.channel}>
          {channelInfo?.posts?.map(({ username, message }, index) => (
            <div key={index} className={styles.post}>
              <span className={styles.username}>{username}</span>
              <span className={styles.message}><Markdown>{message}</Markdown></span>
            </div>
          ))}
          {error && <div className={`${styles.post} ${styles.error}`}>Could not load chatroom: {error}</div>}
        </div>
        <div>
          <form className='flex' onSubmit={onSubmit}>
            <input
              type='text' name='username' className={`${styles.input} w-24 text-center italic`}
              placeholder='guest' title='Type your guest name here'
            />
            <input
              type='text'
              name='message'
              className={`${styles.input} w-full`}
              onKeyDown={onKeyDown}
              required
              title='Send a message to the channel'
              placeholder='got something to say? type it here and hit the enter key to send to the channel'
            />
            <button
              type='submit' className={`${styles.input} ${styles.submit} w-24`} value='Submit'
            >Send
            </button>
          </form>
        </div>
        <div className={styles.channelFooter}>
          <a
            href={`https://chat.paradigmthreat.net/paradigm-threat/channels/${channel}`} target=' _blank'
            rel='noreferrer'
          >
            Open {title || channel} in new window
          </a>
        </div>
      </div>
    </ErrorBoundary>
  )
}
