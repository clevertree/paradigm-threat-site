'use client'

import { useState } from 'react'
import styles from './Image.module.scss'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/client'
import { OptimizedImage } from '@/components'
import { processImageProps } from '@/components/Image/imgUtil'

function PopImage ({ ...props }) {
  const [fullscreen, setFullscreen] = useState(false)

  function toggleFullscreen () {
    setFullscreen(!fullscreen)
  }

  const srcProps = processImageProps(props)

  const content = (
    <OptimizedImage
      onClick={toggleFullscreen}
      {...srcProps}
    />
  )

  if (fullscreen) {
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
            href={src} className="source" target="_blank"
            rel="noreferrer"
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
