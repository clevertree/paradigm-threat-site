import React from 'react'
import { processImageProps } from '@/components/helpers/imageHelper'

interface EmbedFileProps {
    children: React.ReactNode,
    className: string,
    [key: string]: any,
}

export default function EmbedFile({ children, className, ...props }: EmbedFileProps) {
    let srcProps = processImageProps(props)

    return (
        <div className={`flex flex-col w-full min-h-[500px] my-4 ${className || ''}`}>
            <embed
                className="w-full flex-1 bg-white rounded-lg shadow-inner"
                {...srcProps}
            />
            <div className="mt-2 text-sm italic opacity-80">
                {children}
            </div>
            <a
                href={srcProps.href || srcProps.src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs break-all hover:underline mt-1 opacity-60"
            >
                {srcProps.src}
            </a>
        </div>
    )
}
