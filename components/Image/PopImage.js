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
      onClick={toggleFullscreen}
      {...props}
    />
  )

  if (fullscreen) {
    let srcProps = { ...props }
    if (typeof props?.src?.default === 'object') {
      srcProps = { ...props.src.default, ...props }
    } else if (typeof props.src === 'object') { srcProps = { ...props.src, ...props } } else if (typeof props.default === 'object') { srcProps = { ...props.default, ...props } }
    const { children, alt, src } = srcProps
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
