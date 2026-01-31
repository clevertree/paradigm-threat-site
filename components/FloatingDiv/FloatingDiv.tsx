'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { onToggle } from '@/components/helpers/inputHelper'

interface FloatingDivProps {
    children: React.ReactNode,
    containerTag?: string,
    className?: string
}

export default function FloatingDiv({ children, containerTag, className }: FloatingDivProps) {
    const [isDisabled, setIsDisabled] = useState(false)
    const [isScrolling, setIsScrolling] = useState(false)
    const [activeSection, setActiveSection] = useState<string>('')
    const [headings, setHeadings] = useState<{ id: string, text: string, top: number }[]>([])
    const [containerHeight, setContainerHeight] = useState<string | number>('inherit')
    const [leftPosition, setLeftPosition] = useState<number>(0)
    const [containerWidth, setContainerWidth] = useState<number>(0)
    const refContainer = useRef<HTMLElement>(null)
    const headingsRef = useRef(headings)
    const isScrollingRef = useRef(isScrolling)
    const isFloating = !isDisabled && isScrolling;

    useEffect(() => { headingsRef.current = headings }, [headings])
    useEffect(() => { isScrollingRef.current = isScrolling }, [isScrolling])

    const onScroll = useCallback(() => {
        const navElm = refContainer.current
        if (navElm) {
            const { top, height, left, width } = navElm.getBoundingClientRect()
            const currentIsScrolling = isScrollingRef.current
            if (!currentIsScrolling) {
                if (top < 0) {
                    setIsScrolling(true)
                    setContainerHeight(height)
                    setLeftPosition(left)
                    setContainerWidth(width)
                }
            } else {
                if (top > 0) {
                    setIsScrolling(false)
                    setContainerHeight('inherit')
                }
            }
        }

        // Track active section
        const currentHeadings = headingsRef.current
        if (currentHeadings.length > 0) {
            const scrollPos = window.scrollY + 100 // offset for header
            let currentAction = ''
            for (let i = currentHeadings.length - 1; i >= 0; i--) {
                if (scrollPos >= currentHeadings[i].top) {
                    currentAction = currentHeadings[i].text
                    break
                }
            }
            setActiveSection(currentAction)
        }
    }, []) // Now stable

    const updateHeadings = useCallback(() => {
        // Only select headings from the main content article, not from other articles (like search results, carousels, etc.)
        const mainArticle = document.querySelector('main article')
        if (!mainArticle) {
            setHeadings([])
            return
        }
        const articleHeadings = Array.from(mainArticle.querySelectorAll('h1, h2, h3, h4'))
        const headingData = articleHeadings.map(h => ({
            id: h.id,
            text: (h as HTMLElement).innerText,
            top: h.getBoundingClientRect().top + window.scrollY
        })).filter(h => h.id)
        setHeadings(headingData)
    }, [setHeadings])

    function scrollToTop() {
        window.scroll({
            top: 0,
            left: 0,
            behavior: 'smooth'
        })
        if (window.location.hash) {
            window.history.pushState({}, document.title, window.location.pathname)
        }
    }

    function navigateSection(direction: number) {
        const scrollPos = window.scrollY + 110 // offset
        let targetIndex = -1

        if (direction > 0) {
            targetIndex = headings.findIndex(h => h.top > scrollPos)
        } else {
            targetIndex = headings.findLastIndex(h => h.top < scrollPos - 20)
        }

        if (targetIndex !== -1 && headings[targetIndex]) {
            const target = headings[targetIndex]
            window.scroll({
                top: target.top - 100,
                behavior: 'smooth'
            })
        }
    }

    useEffect(() => {
        window.addEventListener('scroll', onScroll)
        onScroll()

        // Initial headings update
        updateHeadings()

        // Update headings on content changes (simplified)
        const observer = new MutationObserver(updateHeadings)
        const mainArticle = document.querySelector('main article')
        if (mainArticle) {
            observer.observe(mainArticle, { childList: true, subtree: true })
        }

        return () => {
            window.removeEventListener('scroll', onScroll)
            observer.disconnect()
        }
    }, [onScroll, updateHeadings])

    const Container = (containerTag as any) || 'div'

    return (
        <Container
            className={`${className}`}
            style={{ height: containerHeight }}
            ref={refContainer}
        >
            <div
                className={(isFloating ? 'fixed top-24 z-50 animate-in fade-in slide-in-from-top-4 duration-300' : '')}
                style={isFloating ? { left: `${leftPosition}px`, width: `${containerWidth}px` } : undefined}
            >
                {children}
                {isFloating && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <div
                            {...onToggle(() => setIsDisabled(true))}
                            title='temporarily hide header'
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 dark:bg-white/20 dark:hover:bg-white/40 cursor-pointer text-sm leading-none"
                        >
                            &#x00d7;
                        </div>
                    </div>
                )}
            </div>

            <div className={`fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 transition-all duration-300 ${!isFloating ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                {activeSection && (
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium mb-1 max-w-[200px] truncate">
                        {activeSection}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg hover:scale-110 active:scale-95 transition-all"
                        onClick={() => navigateSection(-1)}
                        title="Previous section"
                    >
                        -
                    </button>
                    <button
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg hover:scale-110 active:scale-95 transition-all"
                        onClick={() => navigateSection(1)}
                        title="Next section"
                    >
                        +
                    </button>
                    <button
                        className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-sm font-bold"
                        {...onToggle(scrollToTop)}
                    >
                        Back to top
                    </button>
                </div>
            </div>
        </Container>
    )
}
