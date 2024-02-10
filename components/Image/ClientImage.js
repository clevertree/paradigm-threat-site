'use client'

// import Image from 'next/image'
import styles from '@/components/Image/Image.module.scss'

export default function ClientImage ({ children, className, ...props }) {
  let { src, default: defaultSrc, ...srcProps } = props
  if (typeof src === 'object' || typeof defaultSrc === 'object') {
    srcProps = { ...(defaultSrc || (src.default || src)), ...srcProps }
  }

  const { alt, sourceWidth, sourceHeight, blurDataURL, placeholder, ...finalProps } = srcProps
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

const imageSizes = [16, 32, 48, 64, 96, 128, 256, 384]
function getResizedThumbnail ({ src, width, quality = 75 }) {
  for (const imageSize of imageSizes) {
    if (width <= imageSize) {
      return `/_next/image?url=${encodeURIComponent(src)}&w=${imageSize}&q=${quality}`
    }
  }
  return src
}
