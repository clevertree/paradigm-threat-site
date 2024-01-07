'use client'

import Image from 'next/image'
import { useState } from 'react'
import styles from './PopImage.module.scss'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/client'

function PopImage ({ children, className, alt, ...props }) {
  const [fullscreen, setFullscreen] = useState(false)

  let srcProps = { ...props }
  if (typeof props?.src?.default === 'object') {
    srcProps = { ...props.src.default, ...props }
  } else if (typeof props.src === 'object') { srcProps = { ...props.src, ...props } } else if (typeof props.default === 'object') { srcProps = { ...props.default, ...props } }

  function toggleFullscreen (e) {
    setFullscreen(!fullscreen)
  }

  let { src, width, height, placeholder, sourceWidth, sourceHeight, blurDataURL } = srcProps
  if (sourceWidth && sourceHeight && width !== sourceWidth) {
    height = Math.round((width / sourceWidth) * sourceHeight)
  }

  const finalProps = { src, width, height, placeholder, blurDataURL }
  // console.log('finalProps', srcProps, height)
  // if (blurDataURL)
  //   finalProps.style = { backgroundImage: `url('${blurDataURL}')` }
  let content = (
    <Image
      className={`${styles.image} ${className || ''}`}
      onClick={toggleFullscreen}
      {...finalProps}
      alt={alt}
    />
  )

  if (children) {
    content = (
      <div
        className={`${styles.imageCaptionContainer} ${className || ''}`}
        style={{ width: width + 'px' }}
      >
        <Image
          className={styles.image}
          onClick={toggleFullscreen}
          {...finalProps}
          alt={alt}
        />
        {children}
      </div>
    )
  }

  if (fullscreen) {
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
