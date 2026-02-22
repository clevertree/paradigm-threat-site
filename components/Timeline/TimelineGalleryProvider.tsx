'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { ImageGalleryContext, ImageGalleryOverlay } from '@/components/Image/ImageGalleryContext'
import type { GalleryImage, ImageGalleryContextType } from '@/components/Image/ImageGalleryContext'
import type { TimelineEntry } from '@/components/TimelineContext'

interface TimelineGalleryImage extends GalleryImage {
    eventId: string
}

interface TimelineGalleryProviderProps {
    events: TimelineEntry[]
    baseUrl: string
    selectedEventId: string | null
    onSelectEvent: (entry: TimelineEntry) => void
    children: React.ReactNode
}

/**
 * Provides a custom ImageGalleryContext that contains ALL timeline images
 * (from every event's media[]), not just the currently rendered event.
 *
 * When the user navigates in the image overlay to an image belonging to a
 * different event, it calls onSelectEvent to switch the active event.
 */
export function TimelineGalleryProvider({
    events,
    baseUrl,
    selectedEventId,
    onSelectEvent,
    children,
}: TimelineGalleryProviderProps) {
    // Build the complete, ordered image list from all events' media arrays.
    const globalImages = useMemo<TimelineGalleryImage[]>(() => {
        return events.flatMap((event) =>
            (event.media || []).map((path) => ({
                src: `${baseUrl}${path}`,
                alt: path.split('/').pop()?.split('.')[0]?.replace(/_/g, ' ') || '',
                eventId: event.id,
            }))
        )
    }, [events, baseUrl])

    // Stable lookup: src -> eventId
    const srcToEventId = useMemo(() => {
        const map = new Map<string, string>()
        for (const img of globalImages) {
            map.set(img.src, img.eventId)
        }
        return map
    }, [globalImages])

    // Stable lookup: eventId -> TimelineEntry
    const eventById = useMemo(() => {
        const map = new Map<string, TimelineEntry>()
        for (const e of events) map.set(e.id, e)
        return map
    }, [events])

    const [currentIndex, setCurrentIndex] = useState(-1)
    const [isOpen, setIsOpen] = useState(false)

    // Use a ref for the mutable images array to avoid re-render loops during registration.
    const imagesRef = useRef<GalleryImage[]>([...globalImages])

    // When globalImages changes (events reload), reset the ref
    useEffect(() => {
        imagesRef.current = [...globalImages]
        setImagesState([...globalImages])
    }, [globalImages])

    const [imagesState, setImagesState] = useState<GalleryImage[]>([...globalImages])

    /**
     * registerImage: When PopImage mounts, it calls this.
     * - If the src matches a pre-populated image, update its metadata (alt, children, highResSrc)
     *   and return a NO-OP cleanup (image stays in the gallery permanently).
     * - If it doesn't match (safety fallback), add it normally with real cleanup.
     */
    const registerImage = useCallback(
        (img: GalleryImage) => {
            const existingIdx = imagesRef.current.findIndex((i) => i.src === img.src)
            if (existingIdx !== -1) {
                // Update metadata from the rendered PopImage (captions, highResSrc, etc.)
                const existing = imagesRef.current[existingIdx]
                const updated = {
                    ...existing,
                    alt: img.alt || existing.alt,
                    children: img.children ?? existing.children,
                    highResSrc: img.highResSrc || existing.highResSrc,
                }
                imagesRef.current = [
                    ...imagesRef.current.slice(0, existingIdx),
                    updated,
                    ...imagesRef.current.slice(existingIdx + 1),
                ]
                setImagesState([...imagesRef.current])
                // Return no-op cleanup — image is permanent
                return () => { }
            }

            // Unknown image — add it (safety fallback)
            imagesRef.current = [...imagesRef.current, img]
            setImagesState([...imagesRef.current])
            return () => {
                imagesRef.current = imagesRef.current.filter((i) => i.src !== img.src)
                setImagesState([...imagesRef.current])
            }
        },
        []
    )

    const unregisterImage = useCallback((_src: string) => {
        // No-op for timeline: images are permanent
    }, [])

    // When currentIndex changes while overlay is open, check if the image
    // belongs to a different event and switch accordingly.
    const prevIndexRef = useRef(currentIndex)

    useEffect(() => {
        if (!isOpen || currentIndex < 0) {
            prevIndexRef.current = currentIndex
            return
        }
        if (currentIndex === prevIndexRef.current) return
        prevIndexRef.current = currentIndex

        const img = imagesRef.current[currentIndex]
        if (!img) return
        const eventId = srcToEventId.get(img.src)
        if (eventId && eventId !== selectedEventId) {
            const entry = eventById.get(eventId)
            if (entry) {
                onSelectEvent(entry)
            }
        }
    }, [currentIndex, isOpen, selectedEventId, srcToEventId, eventById, onSelectEvent])

    const contextValue = useMemo<ImageGalleryContextType>(
        () => ({
            images: imagesState,
            registerImage,
            unregisterImage,
            currentIndex,
            setCurrentIndex,
            isOpen,
            setIsOpen,
        }),
        [imagesState, registerImage, unregisterImage, currentIndex, isOpen]
    )

    return (
        <ImageGalleryContext.Provider value={contextValue}>
            {children}
            <ImageGalleryOverlay />
        </ImageGalleryContext.Provider>
    )
}
