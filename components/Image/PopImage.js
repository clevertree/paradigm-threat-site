'use client'

import { useState } from 'react'
import styles from './Image.module.scss'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/client'
import { ClientImage } from '@/components'

function PopImage ({ ...props }) {
  const [fullscreen, setFullscreen] = useState(false)

  function toggleFullscreen (e) {
    setFullscreen(!fullscreen)
  }

  const content = (
    <ClientImage
      {...props}
    />
  )

  if (fullscreen) {
    const { children, alt, src } = props
    return (
      <>
        {content}
        <div className={styles.fullscreen} onClick={toggleFullscreen}>
          <img
            src={src}
            className={styles.fullscreenImage}
            alt={alt}
          />
          {children}
          <Link
            href={src} className='source' target='_blank'
            rel='noreferrer'
          >Source File: {src}
          </Link>
          <div className={styles.button}>&#10006;</div>
          {/* <div className={styles.button + ' ' + styles.previous} onClick={renderPreviousAsset}>&#8656;</div> */}
          {/* <div className={styles.button + ' ' + styles.next} onClick={renderNextAsset}>&#8658;</div> */}
        </div>
      </>
    )
  }
  return content
}

export default function PopImageErrorBoundary (props) {
  return (
    <ErrorBoundary>
      <PopImage {...props} />
    </ErrorBoundary>
  )
}
