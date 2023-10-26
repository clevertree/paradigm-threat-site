import React from 'react'

import styles from './ChangeLog.module.css'
import { getGitChangeLog } from '@/server/gitUtil'

export default async function ChangeLog ({ target = '_blank' }) {
  // const [changeLog, setChangeLog] = useState([])
  // const [error, setError] = useState(null)

  // useEffect(() => {
  //     // Fetch top directory
  //     fetch(FETCH_CHANGELOG_URL)
  //         .then(res => res.json())
  //         .then(({changeLog}) => {
  //             setChangeLog(changeLog)
  //         }).catch(error => setError(error))
  // }, [])

  const changeLog = await getGitChangeLog()

  const hashUrl = process.env.NEXT_PUBLIC_GIT_HASH_URL

  return (
    <ul className={styles.changelog}>
      {changeLog.map(entry => (
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
