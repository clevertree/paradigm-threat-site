'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'

interface GalleryImage {
    src: string
    alt?: string
    children?: React.ReactNode
    highResSrc?: string
}

interface ImageGalleryContextType {
    images: GalleryImage[]
    registerImage: (img: GalleryImage) => void
    unregisterImage: (src: string) => void
    currentIndex: number
    setCurrentIndex: (index: number) => void
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
}

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined)
export { ImageGalleryContext }

export function ImageGalleryProvider({ children }: { children: React.ReactNode }) {
    const [images, setImages] = useState<GalleryImage[]>([])
    const [currentIndex, setCurrentIndex] = useState(-1)
    const [isOpen, setIsOpen] = useState(false)

    // Using a ref to track images to avoid re-renders during registration loop
    const imagesRef = useRef<GalleryImage[]>([])

    const registerImage = useCallback((img: GalleryImage) => {
        if (!imagesRef.current.find(i => i.src === img.src)) {
            imagesRef.current = [...imagesRef.current, img]
            setImages([...imagesRef.current])
        }
        return () => {
            imagesRef.current = imagesRef.current.filter(i => i.src !== img.src)
            setImages([...imagesRef.current])
        }
    }, [])

    const unregisterImage = useCallback((src: string) => {
        imagesRef.current = imagesRef.current.filter(i => i.src !== src)
        setImages([...imagesRef.current])
    }, [])

    const contextValue = useMemo(() => ({
        images,
        registerImage,
        unregisterImage,
        currentIndex,
        setCurrentIndex,
        isOpen,
        setIsOpen
    }), [images, registerImage, unregisterImage, currentIndex, isOpen]);

    return (
        <ImageGalleryContext.Provider value={contextValue}>
            {children}
            <ImageGalleryOverlay />
        </ImageGalleryContext.Provider>
    )
}

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { checkFileExists } from '@/components/helpers/imageHelper'

/**
 * Individual image item in the gallery to handle its own loading state
 * and prevent jumpy layout shifts during carousel transitions.
 */
function GalleryImageItem({
    image,
    direction,
    displayCaption,
    goNext,
    goPrev
}: {
    image: GalleryImage,
    direction: number,
    displayCaption: React.ReactNode,
    goNext: () => void,
    goPrev: () => void
}) {
    const [isHighResLoaded, setIsHighResLoaded] = useState(false)
    const [aspectRatio, setAspectRatio] = useState<number | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
            setAspectRatio(imgRef.current.naturalWidth / imgRef.current.naturalHeight)
            setIsHighResLoaded(true)
        }
    }, [image.src])

    return (
        <motion.div
            key={image.src}
            custom={direction}
            initial={{
                x: direction > 0 ? '50%' : direction < 0 ? '-50%' : 0,
                opacity: 0,
                scale: 0.95
            }}
            animate={{
                x: 0,
                opacity: 1,
                scale: 1
            }}
            exit={{
                x: direction < 0 ? '50%' : direction > 0 ? '-50%' : 0,
                opacity: 0,
                scale: 1.05
            }}
            transition={{
                x: { type: "spring", stiffness: 200, damping: 25 },
                opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(e, { offset, velocity }) => {
                const swipe = offset.x
                if (swipe < -100) goNext()
                else if (swipe > 100) goPrev()
            }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 max-w-[95vw] ${aspectRatio && aspectRatio < 1 ? 'lg:max-w-[90vw]' : 'lg:max-w-[75vw]'} max-h-full flex ${aspectRatio && aspectRatio < 1 ? 'flex-col lg:flex-row' : 'flex-col'} items-center justify-center gap-4 lg:gap-8 pointer-events-none`}
            style={{ willChange: 'transform, opacity' }}
        >
            <div className="relative flex-grow flex items-center justify-center min-h-[200px] w-full h-full overflow-hidden">
                <img
                    ref={imgRef}
                    src={image.highResSrc || image.src}
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg pointer-events-auto cursor-grab active:cursor-grabbing transition-opacity duration-300"
                    style={{ opacity: (aspectRatio !== null || isHighResLoaded) ? 1 : 0, maxHeight: '100vh' }}
                    alt={image.alt}
                    onDragStart={(e) => e.preventDefault()}
                    onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0) {
                            setAspectRatio(img.naturalWidth / img.naturalHeight);
                            setIsHighResLoaded(true);
                        }
                    }}
                />
            </div>
            {displayCaption && (
                <div className={`text-white/90 font-medium px-4 ${aspectRatio && aspectRatio < 1 ? 'lg:max-w-xs lg:text-left' : 'max-w-2xl text-center'} text-shadow-lg pointer-events-auto max-h-[20vh] lg:max-h-full overflow-y-auto`}>
                    {displayCaption}
                </div>
            )}
        </motion.div>
    )
}

function ImageGalleryOverlay() {
    const { images, currentIndex, setCurrentIndex, isOpen, setIsOpen } = useImageGallery()
    const [direction, setDirection] = useState(0)
    const [remoteCaption, setRemoteCaption] = useState<string | null>(null)

    const currentImage = images[currentIndex] || null

    useEffect(() => {
        // Preload next and previous images
        if (isOpen && images.length > 1) {
            const nextIdx = (currentIndex + 1) % images.length;
            const prevIdx = (currentIndex - 1 + images.length) % images.length;

            [images[nextIdx], images[prevIdx]].forEach(img => {
                if (img && (img.highResSrc || img.src)) {
                    const preload = new Image();
                    preload.src = img.highResSrc || img.src;
                }
            });
        }
    }, [currentIndex, isOpen, currentImage?.src, images])

    useEffect(() => {
        if (!isOpen || !currentImage) return

        const currentSrc = currentImage.src;
        if (!currentImage.children && !currentImage.alt && currentSrc && !currentSrc.startsWith('http')) {
            const FILES_BASE_URL = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files';

            // Fix double slashes and ensure no leading slash for index check
            const cleanSrc = currentSrc.replace(/\/+/g, '/').replace(/^\/+/, '');
            const mdPath = `${cleanSrc}.md`;

            checkFileExists(mdPath).then(exists => {
                if (exists) {
                    fetch(`${FILES_BASE_URL}/${mdPath}`)
                        .then(res => res.ok ? res.text() : null)
                        .then(text => setRemoteCaption(text))
                        .catch(() => setRemoteCaption(null));
                } else {
                    setRemoteCaption(null);
                }
            });
        } else {
            setRemoteCaption(null);
        }
    }, [isOpen, currentImage])

    const goNext = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation()
        if (images.length > 1) {
            setDirection(1)
            setCurrentIndex((currentIndex + 1) % images.length)
        }
    }, [currentIndex, images.length, setCurrentIndex])

    const goPrev = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation()
        if (images.length > 1) {
            setDirection(-1)
            setCurrentIndex((currentIndex - 1 + images.length) % images.length)
        }
    }, [currentIndex, images.length, setCurrentIndex])

    const closeFullscreen = useCallback(() => {
        if (window.location.hash.startsWith('#img=')) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        setIsOpen(false)
    }, [setIsOpen])

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goNext(e);
            if (e.key === 'ArrowLeft') goPrev(e);
            if (e.key === 'Escape') closeFullscreen();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, goNext, goPrev, closeFullscreen]);

    // Update hash for deep linking when open
    useEffect(() => {
        if (isOpen && currentImage) {
            const newHash = `#img=${encodeURIComponent(currentImage.src)}`;
            if (window.location.hash !== newHash) {
                window.history.replaceState(null, '', newHash);
            }
        }
    }, [isOpen, currentIndex, currentImage]);

    if (!currentImage) return null

    const prevImage = images.length > 1 ? images[(currentIndex - 1 + images.length) % images.length] : null;
    const nextImage = images.length > 1 ? images[(currentIndex + 1) % images.length] : null;
    const fallbackCaption =
        typeof currentImage.src === 'string'
            ? currentImage.src.split('/').pop()?.split('.')[0]?.replace(/_/g, ' ')
            : '';
    const displayCaption =
        typeof currentImage.children === 'string'
            ? currentImage.children
            : remoteCaption || currentImage.alt || fallbackCaption;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12 select-none"
                    onClick={closeFullscreen}
                >
                    {/* Header Controls */}
                    <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="text-white/50 text-sm font-mono whitespace-nowrap overflow-hidden text-ellipsis mr-4">
                            {currentIndex + 1} / {images.length} — {currentImage.src}
                        </div>
                        <button
                            onClick={closeFullscreen}
                            className="text-white/60 hover:text-white transition-colors p-4 -m-4 z-50 pointer-events-auto"
                        >
                            <X size={32} />
                        </button>
                    </div>

                    {/* Navigation Previews */}
                    <div className="absolute inset-x-0 inset-y-0 pointer-events-none flex items-center justify-between px-4 z-40">
                        {/* Prev Preview */}
                        <div className="w-1/4 h-full flex items-center justify-start overflow-hidden">
                            <AnimatePresence initial={false} custom={direction}>
                                {prevImage && (
                                    <motion.button
                                        key={`prev-${prevImage.src}`}
                                        custom={direction}
                                        initial={{ x: direction > 0 ? 100 : -100, opacity: 0 }}
                                        animate={{ x: 0, opacity: 0.2 }}
                                        exit={{ x: direction < 0 ? 100 : -100, opacity: 0 }}
                                        transition={{
                                            x: { type: "spring", stiffness: 300, damping: 30 },
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="group pointer-events-auto cursor-pointer border-none bg-transparent outline-none appearance-none ml-8"
                                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                        aria-label="Previous image"
                                    >
                                        <motion.div
                                            whileHover={{ opacity: 0.5, scale: 1.05 }}
                                            className="relative h-[25vh] aspect-square hidden lg:flex items-center justify-center rounded-2xl overflow-hidden"
                                        >
                                            <img
                                                src={`/api/image?path=${encodeURIComponent(prevImage.src)}&w=400`}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                alt="prev"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <ChevronLeft size={48} className="text-white" />
                                            </div>
                                        </motion.div>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Next Preview */}
                        <div className="w-1/4 h-full flex items-center justify-end overflow-hidden">
                            <AnimatePresence initial={false} custom={direction}>
                                {nextImage && (
                                    <motion.button
                                        key={`next-${nextImage.src}`}
                                        custom={direction}
                                        initial={{ x: direction < 0 ? -100 : 100, opacity: 0 }}
                                        animate={{ x: 0, opacity: 0.2 }}
                                        exit={{ x: direction > 0 ? -100 : 100, opacity: 0 }}
                                        transition={{
                                            x: { type: "spring", stiffness: 300, damping: 30 },
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="group pointer-events-auto cursor-pointer border-none bg-transparent outline-none appearance-none mr-8"
                                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                                        aria-label="Next image"
                                    >
                                        <motion.div
                                            whileHover={{ opacity: 0.5, scale: 1.05 }}
                                            className="relative h-[25vh] aspect-square hidden lg:flex items-center justify-center rounded-2xl overflow-hidden"
                                        >
                                            <img
                                                src={`/api/image?path=${encodeURIComponent(nextImage.src)}&w=400`}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                alt="next"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <ChevronRight size={48} className="text-white" />
                                            </div>
                                        </motion.div>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Main Image */}
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                        <GalleryImageItem
                            key={currentImage.src}
                            image={currentImage}
                            direction={direction}
                            displayCaption={displayCaption}
                            goNext={goNext}
                            goPrev={goPrev}
                        />
                    </AnimatePresence>

                    {/* Mobile Controls */}
                    <div className="absolute bottom-10 left-0 right-0 md:hidden flex justify-center gap-12 pointer-events-none z-50">
                        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className={`p-4 rounded-full bg-white/10 backdrop-blur-md text-white pointer-events-auto ${!prevImage && 'opacity-20'}`} disabled={!prevImage}>
                            <ChevronLeft size={32} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); goNext(); }} className={`p-4 rounded-full bg-white/10 backdrop-blur-md text-white pointer-events-auto ${!nextImage && 'opacity-20'}`} disabled={!nextImage}>
                            <ChevronRight size={32} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export function useImageGallery() {
    const context = useContext(ImageGalleryContext)
    if (context === undefined) {
        throw new Error('useImageGallery must be used within an ImageGalleryProvider')
    }
    return context
}
