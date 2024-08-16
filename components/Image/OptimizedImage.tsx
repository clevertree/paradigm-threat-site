import styles from '@/components/Image/Image.module.scss'
import {processImageProps} from '@/components/Image/imgUtil'
import React from "react";

interface OptimizedImageProps {
    children?: React.ReactNode,
    className?: string,

    [key: string]: any
}

export default function OptimizedImage({children, className, ...props}: OptimizedImageProps) {
    const srcProps: OptimizedImageProps = processImageProps(props)

    const {alt, priority, blurDataURL, optimizedSrc, ...finalProps} = srcProps

    if (blurDataURL) {
        finalProps.style = {backgroundImage: `url('${blurDataURL}')`}
    }
    // if (typeof finalProps.loading === 'undefined') { finalProps.loading = 'lazy' }
    if (optimizedSrc) {
        finalProps.src = optimizedSrc
    }

    return (
        <figure
            className={`${styles.imageCaptionContainer} ${className || ''}`}
            style={{maxWidth: finalProps.width + 'px'}}
        >
            <img
                loading='lazy'
                alt={alt}
                className={styles.image}
                {...finalProps}
            />
            {children ? <figcaption>{children}</figcaption> : null}
        </figure>
    )
}
