'use client'

import Image from 'next/image'
import styles from '@/components/Image/Image.module.scss'

export default function ClientImage ({ children, className, ...props }) {
  let srcProps = { ...props }
  if (typeof props?.src?.default === 'object') {
    srcProps = { ...props.src.default, ...props }
  } else if (typeof props.src === 'object') { srcProps = { ...props.src, ...props } } else if (typeof props.default === 'object') { srcProps = { ...props.default, ...props } }

  const { sourceWidth, sourceHeight, ...finalProps } = srcProps
  if (sourceWidth && sourceHeight && finalProps.width !== sourceWidth) {
    finalProps.height = Math.round((finalProps.width / sourceWidth) * sourceHeight)
  }
  if (!srcProps.width) { console.error('Invalid image width: ', srcProps) }
  // console.log('finalProps', finalProps)
  // if (blurDataURL) { finalProps.style = { backgroundImage: `url('${blurDataURL}')` } }
  // finalProps.src = getResizedThumbnail(finalProps)
  let content = (
    <Image
      className={`${styles.image} ${className || ''}`}
      unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZE_IMAGES}
      {...finalProps}
    />
  )

  if (children) {
    content = (
      <figure
        className={`${styles.imageCaptionContainer} ${className || ''}`}
        style={{ maxWidth: finalProps.width + 'px' }}
      >
        <Image
          className={styles.image}
          unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZE_IMAGES}
          {...finalProps}
        />
        <figcaption>{children}</figcaption>
      </figure>
    )
  }
  return content
}

// function getResizedThumbnail ({ src, width, quality = 75 }) {
//   return `_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
// }
