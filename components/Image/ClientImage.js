'use client'

// import Image from 'next/image'
import styles from '@/components/Image/Image.module.scss'
import { getResizedThumbnail, processImageProps } from '@/components/Image/imgUtil'

export default function ClientImage ({ children, className, ...props }) {
  const srcProps = processImageProps(props)

  const { alt, priority, sourceWidth, sourceHeight, blurDataURL, placeholder, ...finalProps } = srcProps
  if (sourceWidth && sourceHeight && finalProps.width !== sourceWidth) {
    finalProps.height = Math.round((finalProps.width / sourceWidth) * sourceHeight)
  }
  // if (!srcProps.width) { console.error('Invalid image width: ', srcProps) }
  // console.log('finalProps', finalProps)
  if (blurDataURL) { finalProps.style = { backgroundImage: `url('${blurDataURL}')` } }

  finalProps.src = getResizedThumbnail(finalProps)
  let content = (
    <img
      loading='lazy'
      alt={alt}
      className={`${styles.image} ${className || ''}`}
      {...finalProps}
    />
  )

  if (children) {
    content = (
      <figure
        className={`${styles.imageCaptionContainer} ${className || ''}`}
        style={{ maxWidth: finalProps.width + 'px' }}
      >
        <img
          loading='lazy'
          alt={alt}
          className={styles.image}
          {...finalProps}
        />
        <figcaption>{children}</figcaption>
      </figure>
    )
  }
  return content
}
