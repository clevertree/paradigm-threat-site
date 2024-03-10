// import Image from 'next/image'
import styles from '@/components/Image/Image.module.scss'
import { processImageProps } from '@/components/Image/imgUtil'

export default function OptimizedImage ({ children, className, ...props }) {
  const srcProps = processImageProps(props)

  const { alt, priority, blurDataURL, optimizedSrc, format, ...finalProps } = srcProps

  if (blurDataURL) { finalProps.style = { backgroundImage: `url('${blurDataURL}')` } }
  // if (typeof finalProps.loading === 'undefined') { finalProps.loading = 'lazy' }
  if (optimizedSrc) { finalProps.src = optimizedSrc }

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
