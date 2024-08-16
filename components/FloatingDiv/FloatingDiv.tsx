'use client'

import React, {useEffect, useRef, useState} from 'react'

import styles from './FloatingDiv.module.scss'
import {onToggle} from '@/components/helpers/input'

interface FloatingDivProps {
    children: React.ReactNode,
    containerTag?: string,
    className: string
}

export default function FloatingDiv({children, containerTag, className}: FloatingDivProps) {
    const [isFloating, setIsFloating] = useState(false)
    const [containerHeight, setContainerHeight] = useState<string | number>('inherit')
    const refContainer = useRef<HTMLElement>()

    function onScroll() {
        const navElm = refContainer.current
        if (navElm) {
            const {top, height} = navElm.getBoundingClientRect()
            // console.log(top, height, isFloating)
            if (!isFloating) {
                if (top < 0) {
                    setIsFloating(true)
                    setContainerHeight(height)
                }
            } else if (isFloating) {
                if (top > 0) {
                    // console.log('isFloating', isFloating, top, top > 0)
                    setIsFloating(false)
                    setContainerHeight('inherit')
                }
            }
        }
    }

    function scrollToTop() {
        window.scroll({
            top: 0,
            left: 0,
            behavior: 'smooth'
        })
        window.history.pushState('', document.title, window.location.pathname)
    }

    useEffect(() => {
        window.addEventListener('scroll', onScroll)
        onScroll()
        return () => window.removeEventListener('scroll', onScroll)
    })

    const Container = containerTag || 'div'

    return (
        // @ts-ignore
        <Container
            className={className}
            style={{height: containerHeight}}
            ref={refContainer}
        >
            <div
                className={(isFloating ? ' ' + styles.floatingDiv : '')}
            >
                {children}
            </div>
            <button
                className={`${styles.bottomText} ${!isFloating ? styles.bottomTextHidden : ''}`}
                {...onToggle(scrollToTop)}
                tabIndex={isFloating ? 0 : -1} // TODO: move  to own component
            >Back to top
            </button>
        </Container>
    )
}
