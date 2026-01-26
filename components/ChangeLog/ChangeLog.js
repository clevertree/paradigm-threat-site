'use client'

import React, { useState, useEffect } from 'react'
import styles from './ChangeLog.module.css'

export default function ChangeLog({ target = '_blank' }) {
  const [changeLog, setChangeLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchChangeLog = async () => {
      try {
        const filesBaseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files'
        const res = await fetch(`${filesBaseUrl}/changelog.json`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setChangeLog(data)
        }
      } catch (e) {
        console.error('Failed to fetch changelog.json from files repo', e)
      } finally {
        setLoading(false)
      }
    }

    fetchChangeLog()
  }, [])

  const hashUrl = process.env.NEXT_PUBLIC_GIT_HASH_URL || 'https://github.com/clevertree/paradigm-threat-files/commit/'

  if (loading) {
    return <div className="animate-pulse flex space-x-4 p-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div></div></div>
  }

  return (
    <ul className={styles.changelog}>
      {Array.isArray(changeLog) && changeLog.map(entry => (
        <li key={entry.hash}>
          <a
            href={hashUrl + entry.hash}
            target={target}
          >{new Date(entry.date).toLocaleDateString('en-US')} - {entry.message}
          </a>
        </li>
      ))}
    </ul>
  )
}
