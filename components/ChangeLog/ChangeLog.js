import React from 'react'

import styles from './ChangeLog.module.css'
// import { getGitChangeLog } from '@/server/gitUtil'

export default async function ChangeLog({ changeLog = [], target = '_blank' }) {
  if (changeLog.length === 0) {
    try {
      const filesBaseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';
      const res = await fetch(`${filesBaseUrl}/changelog.json`, { cache: 'no-store' });
      if (res.ok) {
        changeLog = await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch changelog.json from files repo', e);
    }
  }
  const hashUrl = process.env.NEXT_PUBLIC_GIT_HASH_URL || 'https://github.com/clevertree/paradigm-threat-files/commit/'

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
