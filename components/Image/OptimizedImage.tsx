'use client'

import { processImageProps } from '@/components/helpers/imageHelper'
import React, { useState, useEffect, useRef } from "react";

interface OptimizedImageProps {
    children?: React.ReactNode,
    className?: string,

    [key: string]: any
}

/** DOM-safe subset of props to pass to <img> (exclude custom/React-only props). */
const IMG_ATTRS = new Set(['src', 'alt', 'width', 'height', 'loading', 'title', 'style', 'referrerPolicy', 'sizes', 'crossOrigin', 'decoding', 'fetchPriority'])

/** 1x1 transparent GIF — use instead of empty string to avoid browser "download whole page" warning */
const EMPTY_SRC_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export default function OptimizedImage({ children, className, ...props }: OptimizedImageProps) {
    const srcProps: OptimizedImageProps = processImageProps({ ...props, className }, props.basePath)
    const [isVisible, setIsVisible] = useState(false)
    const ref = useRef<HTMLImageElement>(null)

    const {
        alt,
        priority,
        blurDataURL,
        optimizedSrc,
        highResSrc,
        basePath,
        className: processedClassName,
        ...rest
    } = srcProps
    const finalProps: Record<string, unknown> = {}
    Object.keys(rest).forEach((key) => {
        if (IMG_ATTRS.has(key)) finalProps[key] = (rest as Record<string, unknown>)[key]
    })

    useEffect(() => {
        if (priority) {
            queueMicrotask(() => setIsVisible(true))
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px' } // Load 200px before it enters view
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [priority])

    if (optimizedSrc) {
        finalProps['data-original-src'] = finalProps.src;
        finalProps.src = optimizedSrc
    }

    // Wide book diagrams often have index/API dimensions that do not match the decoded bitmap;
    // a forced aspect-ratio box then leaves a large empty band above the caption (especially on mobile).
    const isBookIllustration = /\bbook-illustration\b/.test(processedClassName || '')
    const containerStyle: React.CSSProperties = {}
    if (isBookIllustration) {
        if (blurDataURL) {
            containerStyle.backgroundImage = `url('${blurDataURL}')`
            containerStyle.backgroundSize = 'contain'
            containerStyle.backgroundPosition = 'center top'
            containerStyle.backgroundRepeat = 'no-repeat'
        }
    } else if (finalProps.width && finalProps.height) {
        containerStyle.aspectRatio = `${finalProps.width}/${finalProps.height}`
        if (blurDataURL) {
            containerStyle.backgroundImage = `url('${blurDataURL}')`
            containerStyle.backgroundSize = 'cover'
            containerStyle.backgroundPosition = 'center'
        }
    } else {
        containerStyle.minHeight = '100px'
        if (blurDataURL) {
            containerStyle.backgroundImage = `url('${blurDataURL}')`
            containerStyle.backgroundSize = 'cover'
            containerStyle.backgroundPosition = 'center'
        }
    }

    return (
        <figure
            className={`${processedClassName || ''} overflow-hidden not-prose`}
            style={finalProps.width ? { maxWidth: `${finalProps.width}px` } : {}}
        >
            <div
                className={`relative w-full bg-slate-100 dark:bg-slate-900 overflow-hidden ${!isVisible ? 'animate-pulse' : ''} ${isBookIllustration && !isVisible ? 'min-h-12' : ''}`}
                style={containerStyle}
            >
                {/* next/image not used: dynamic src/placeholder and aspect ratio from props */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    ref={ref}
                    loading='lazy'
                    alt={alt}
                    className={`block w-full max-w-full h-auto transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                    {...finalProps}
                    src={isVisible && finalProps.src ? (finalProps.src as string) : EMPTY_SRC_PLACEHOLDER}
                />
            </div>
            {children
                ? <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic text-justify px-2">{children}</figcaption>
                : alt ? <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic text-justify px-2">{alt}</figcaption> : null
            }
        </figure>
    )
}
