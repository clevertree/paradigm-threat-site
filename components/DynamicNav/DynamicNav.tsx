'use client'

import React from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DynamicNavProps {
    children?: React.ReactNode,
    className: string,
    directory: Record<string, any> // Can be nested PathDirectory or flat Files object

    [key: string]: any,
}

export default function DynamicNav({ directory: inputDirectory, children, className }: DynamicNavProps) {
    const currentPath = usePathname()

    // Reconstruct nested directory tree if we received the flat files object or array
    const directory = React.useMemo(() => {
        if (!inputDirectory) return {};

        let paths: string[] = [];
        if (Array.isArray(inputDirectory)) {
            paths = inputDirectory;
        } else {
            // It's an object. Check if it's flat paths or nested tree
            const keys = Object.keys(inputDirectory);
            const isFlat = keys.some(key => key.startsWith('/') && key.length > 1);
            if (!isFlat) return inputDirectory;
            paths = keys;
        }

        const tree: Record<string, any> = {};
        paths.forEach(path => {
            if (path === '/' || !path) return;
            // Ensure path starts with / for relative splitting if it doesn't already
            const normalizedPath = path.startsWith('/') ? path : '/' + path;
            const parts = normalizedPath.split('/').filter(Boolean);

            let current = tree;
            parts.forEach((part, index) => {
                // If it's a file (has extension and is the last part), we don't add it as a directory
                // unless it is part of the path logic we want to show.
                // The request says "only list directories".
                if (index === parts.length - 1 && part.includes('.')) {
                    return;
                }

                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            });
        });
        return tree;
    }, [inputDirectory]);

    function renderDirectory(directoryList: any, directoryPath: string, children: React.ReactNode = null) {
        return (
            <div key={directoryPath} className={`flex flex-col space-y-1 ${className || ''}`}>
                {children}
                {Object.keys(directoryList).map(subPathName => {
                    const relativeSubPathName = directoryPath + subPathName
                    return (
                        <Link
                            prefetch={false}
                            key={subPathName}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${currentPath.startsWith(relativeSubPathName)
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            href={relativeSubPathName}
                        >{(subPathName.split('/').pop() || '').replace(/_/g, ' ')}
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
        // filter(Boolean) removes the empty strings from leading/trailing slashes
        const splitPath = currentPath.split('/').filter(Boolean)
        let directoryPointer = directory
        let currentLevelPath = '/'

        for (const subPath of splitPath) {
            if (directoryPointer[subPath] && Object.keys(directoryPointer[subPath]).length > 0) {
                directoryPointer = directoryPointer[subPath]
                currentLevelPath += subPath + '/'

                // Add a visual separator if there are multiple levels
                content.push(
                    <div key={`sep-${currentLevelPath}`} className="pt-2 pb-1 border-t border-slate-200 dark:border-slate-800 mt-2">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 group">
                            <span className="opacity-50">/</span> {subPath.replace(/_/g, ' ')}
                        </div>
                    </div>
                )
                content.push(renderDirectory(directoryPointer, currentLevelPath))
            } else {
                // If we reach a level without children or a path that isn't a directory, we stop
                break
            }
        }
    }
    return <div className="space-y-1">{content}</div>
}
