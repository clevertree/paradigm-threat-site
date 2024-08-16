import styles from './EmbedFile.module.scss'
import React from 'react'
import {processImageProps} from '@/components/helpers/imageHelper'

interface EmbedFileProps {
    children: React.ReactNode,
    className: string,

    [key: string]: any,
}

export default function EmbedFile({children, className, ...props}: EmbedFileProps) {
    let srcProps = processImageProps(props)

    return (
        <div className={`${styles.embedContainer} ${className}`}>
            <embed
                className={styles.embed}
                {...srcProps}
            />
            {children}
            <a href={srcProps.href || srcProps.src}
               target="_blank"
               rel="noopener noreferrer">{srcProps.src}</a>
        </div>
    )
}
