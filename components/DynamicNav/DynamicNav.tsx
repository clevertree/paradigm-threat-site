'use client'

import React from 'react'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import styles from './DynamicNav.module.scss'

interface DynamicNavProps {
    children: React.ReactNode,
    className: string,
    directory: PathDirectory

    [key: string]: any,
}

interface PathDirectory {
    [key: string]: PathDirectory
}

export default function DynamicNav({directory, children, className}: DynamicNavProps) {
    const currentPath = usePathname()

    function renderDirectory(directoryList: PathDirectory, directoryPath: string, children: React.ReactNode = null) {
        return (
            <div key={directoryPath} className={styles.container + ' ' + className}>
                {children}
                {Object.keys(directoryList).map(subPathName => {
                    const relativeSubPathName = directoryPath + subPathName
                    // console.log('currentPath', currentPath, relativeSubPathName, currentPath.startsWith(relativeSubPathName))
                    return (
                        <Link
                            key={subPathName}
                            className={currentPath.startsWith(relativeSubPathName) ? styles.current : ''}
                            href={relativeSubPathName}
                        >{(subPathName.split('/').pop() || '').replace('_', ' ')}
                        </Link>
                    )
                })}
            </div>
        )
    }

    if (!directory) {
        return null
    }

    const content = [
        renderDirectory(directory, '/', children)
    ]
    if (currentPath) {
        const splitPath = currentPath.split('/')
        let directoryPointer = directory
        let iSubPath = '/'
        for (const subPath of splitPath) {
            if (directoryPointer[subPath] &&
                Object.keys(directoryPointer[subPath]).length > 0) {
                directoryPointer = directoryPointer[subPath]
                iSubPath += subPath + '/'
                content.push(renderDirectory(directoryPointer, iSubPath))
            }
        }
    }
    return content
}
