'use client'

import { processImageProps } from '@/components/helpers/imageHelper'
import React, { useState, useEffect, useRef } from "react";

interface OptimizedImageProps {
    children?: React.ReactNode,
    className?: string,

    [key: string]: any
}

export default function OptimizedImage({ children, className, ...props }: OptimizedImageProps) {
    const srcProps: OptimizedImageProps = processImageProps({ ...props, className }, props.basePath)
    const [isVisible, setIsVisible] = useState(false)
    const ref = useRef<HTMLImageElement>(null)

    const { alt, priority, blurDataURL, optimizedSrc, className: processedClassName, ...finalProps } = srcProps

    useEffect(() => {
        if (priority) {
            setIsVisible(true)
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

    if (blurDataURL) {
        finalProps.style = { backgroundImage: `url('${blurDataURL}')` }
    }

    if (optimizedSrc) {
        finalProps['data-original-src'] = finalProps.src;
        finalProps.src = optimizedSrc
    }

    return (
        <figure
            className={`${processedClassName || ''} overflow-hidden not-prose`}
            style={finalProps.width ? { maxWidth: `${finalProps.width}px` } : {}}
        >
            <div
                className={`relative w-full bg-slate-100 dark:bg-slate-900 overflow-hidden ${!isVisible ? 'animate-pulse' : ''}`}
                style={finalProps.width && finalProps.height ? { aspectRatio: `${finalProps.width}/${finalProps.height}` } : { minHeight: '100px' }}
            >
                <img
                    ref={ref}
                    loading='lazy'
                    alt={alt}
                    className={`w-full h-auto transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                    {...finalProps}
                    src={isVisible ? finalProps.src : ''}
                />
            </div>
            {children ? <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic text-center px-2">{children}</figcaption> : null}
        </figure>
    )
}
