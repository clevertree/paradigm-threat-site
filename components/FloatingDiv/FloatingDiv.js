'use client'

import React, { useEffect, useRef, useState } from 'react'

import styles from './FloatingDiv.module.scss'

export default function FloatingDiv ({ children, containerElm, className }) {
  const [isFloating, setIsFloating] = useState(false)
  const [containerHeight, setContainerHeight] = useState('inherit')
  const refContainer = useRef()

  function onScroll () {
    const navElm = refContainer.current
    const { top, height } = navElm.getBoundingClientRect()
    // console.log(top, height, isFloating)
    if (!isFloating) {
      if (top < 0) {
        console.log('isFloating', isFloating, top < 0)
        setIsFloating(true)
        setContainerHeight(height)
      }
    } else if (isFloating) {
      if (top > 0) {
        console.log('isFloating', isFloating, top, top > 0)
        setIsFloating(false)
        setContainerHeight('inherit')
      }
    }
  }

  function scrollToTop () {
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  })

  const Container = containerElm || 'div'

  return (
    <Container
      className={className}
      style={{ height: containerHeight }}
      ref={refContainer}
    >
      <div
        className={(isFloating ? ' ' + styles.floatingDiv : '')}
      >
        {children}
      </div>
      <div
        className={`${styles.bottomText} ${!isFloating ? styles.bottomTextHidden : ''}`}
        onClick={scrollToTop}
      >Back to top
      </div>
    </Container>
  )
}
