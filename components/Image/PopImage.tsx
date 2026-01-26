'use client'

import React, { useState, useEffect, memo } from 'react'
import { Maximize2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/client'
import { OptimizedImage } from '@/components'
import { processImageProps } from '@/components/helpers/imageHelper'
import { onToggle } from '@/components/helpers/inputHelper'
import { useImageGallery } from './ImageGalleryContext'

interface PopImageProps {
    children?: any,
    className?: string,
    basePath?: string,
    [key: string]: any
}

const PopImage = memo(function PopImage({ ...props }: PopImageProps) {
    const { registerImage, images, currentIndex, setCurrentIndex, setIsOpen } = useImageGallery()
    const srcProps = processImageProps(props, props.basePath)
    const { children, alt, src, highResSrc } = srcProps

    useEffect(() => {
        return registerImage({ src, alt, children, highResSrc });
    }, [src, alt, children, highResSrc, registerImage]);

    function toggleFullscreen() {
        const selfIndex = images.findIndex(img => img.src === src);
        if (selfIndex !== -1) {
            setCurrentIndex(selfIndex);
            setIsOpen(true);
        }
    }

    // Handles deep linking for this specific image on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash;
        if (hash.startsWith('#img=')) {
            const targetSrc = decodeURIComponent(hash.slice(5));
            if (targetSrc === src) {
                const selfIndex = images.findIndex(img => img.src === src);
                if (selfIndex !== -1) {
                    setCurrentIndex(selfIndex);
                    setIsOpen(true);

                    // Scroll immediately
                    requestAnimationFrame(() => {
                        const id = `img-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;
                        const el = document.getElementById(id);
                        if (el) {
                            el.scrollIntoView({ behavior: 'auto', block: 'center' });
                        }
                    });
                }
            }
        }
    }, [src, images, setCurrentIndex, setIsOpen]);

    const userClasses = srcProps.className || ''
    const hasFloat = userClasses.includes('float-')
    const hasClear = userClasses.includes('clear-')
    const hasMargin = userClasses.includes('m-') || userClasses.includes('mx-') || userClasses.includes('my-')

    const finalClassName = `${userClasses} ${!hasFloat && !hasClear ? 'clear-both' : ''} ${!hasMargin ? 'm-auto' : ''} w-fit cursor-pointer group shadow-lg hover:shadow-xl dark:shadow-blue-900/10 transition-shadow duration-300 rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 not-prose`

    const { className: _className, children: _children, ...optimizedImageProps } = srcProps;

    return (
        <div
            id={`img-${src.replace(/[^a-zA-Z0-9]/g, '-')}`}
            className={finalClassName}
            {...onToggle(toggleFullscreen)}
            style={{ maxWidth: srcProps.width ? `${srcProps.width}px` : '100%' }}
        >
            <div className="relative group">
                <OptimizedImage
                    {...optimizedImageProps}
                >
                    {children}
                </OptimizedImage>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={48} />
                </div>
            </div>
        </div>
    )
})

export default function PopImageErrorBoundary(props: PopImageProps) {
    return (
        <ErrorBoundary assetName="PopImage">
            <PopImage {...props} />
        </ErrorBoundary>
    )
}
