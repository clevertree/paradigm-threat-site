'use client'

import React, {useState} from 'react'
import styles from './Image.module.scss'
import Link from 'next/link'
import {ErrorBoundary} from '@/components/client'
import {OptimizedImage} from '@/components'
import {processImageProps} from '@/components/Image/imgUtil'
import {onToggle} from '@/components/helpers/input'

interface PopImageProps {
    children?: React.ReactNode,
    className?: string,

    [key: string]: any
}

function PopImage({...props}: PopImageProps) {
    const [fullscreen, setFullscreen] = useState(false)

    function toggleFullscreen() {
        setFullscreen(!fullscreen)
    }

    const srcProps: PopImageProps = processImageProps(props)

    const content = (
        <OptimizedImage
            {...onToggle(toggleFullscreen)}
            tabIndex={0}
            {...srcProps}
        />
    )

    if (fullscreen) {
        const {children, alt, src} = srcProps
        return (
            <>
                {content}
                <div className={styles.fullscreen}
                     {...onToggle(toggleFullscreen)}>
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

export default function PopImageErrorBoundary(props: PopImageProps) {
    return (
        <ErrorBoundary>
            <PopImage {...props} />
        </ErrorBoundary>
    )
}
