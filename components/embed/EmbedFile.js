'use client'

import styles from './EmbedFile.module.scss'
import React from 'react'

export default function EmbedFile ({ children, className, ...props }) {
  let srcProps = props
  if (typeof props?.src?.default === 'object') { srcProps = { ...props, ...props.src.default } } else if (typeof props.src === 'object') { srcProps = { ...props, ...props.src } }

  return (
    <div className={`${styles.container} ${className}`}>
      <embed
        {...srcProps}
      />
      {children}
      <a href={srcProps.href || srcProps.src} target='_blank' rel='noopener noreferrer'>{srcProps.src}</a>
    </div>
  )
}
