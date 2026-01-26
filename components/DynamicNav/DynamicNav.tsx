'use client'

import React, { memo } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DynamicNavProps {
    children?: React.ReactNode,
    className: string,
    directory: Record<string, any> // Can be nested PathDirectory or flat Files object

    [key: string]: any,
}

const DynamicNav = memo(function DynamicNav({ directory: inputDirectory, children, className }: DynamicNavProps) {
    const currentPath = usePathname()

    // Reconstruct nested directory tree if we received the flat files object or array
    const directory = React.useMemo(() => {
        if (!inputDirectory) return {};

        if (Array.isArray(inputDirectory)) {
            const tree: Record<string, any> = {};
            inputDirectory.forEach(path => {
                if (path === '/' || !path) return;
                const normalizedPath = path.startsWith('/') ? path : '/' + path;
                const parts = normalizedPath.split('/').filter(Boolean);

                let current = tree;
                parts.forEach((part: string, index: number) => {
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
        } else {
            // It's already a tree, but we might need to filter out files and non-directory keys
            const cleanTree = (node: any) => {
                const result: any = {};
                Object.keys(node).forEach(key => {
                    if (key === '_count') {
                        result[key] = node[key];
                    } else if (node[key] !== null && typeof node[key] === 'object' && '_count' in node[key]) {
                        result[key] = cleanTree(node[key]);
                    }
                });
                return result;
            };
            return cleanTree(inputDirectory);
        }
    }, [inputDirectory]);

    function renderDirectory(directoryList: any, directoryPath: string, children: React.ReactNode = null) {
        return (
            <div key={directoryPath} className={`flex flex-col space-y-1 ${className || ''}`}>
                {children}
                {Object.keys(directoryList).filter(k => k !== '_count').map(subPathName => {
                    const relativeSubPathName = directoryPath + subPathName
                    const subPathData = directoryList[subPathName];
                    const count = subPathData?._count || 0;
                    const title = subPathData?._title;
                    return (
                        <Link
                            prefetch={false}
                            key={subPathName}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex justify-between items-center ${currentPath.startsWith(relativeSubPathName)
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            href={relativeSubPathName}
                        >
                            <span>{title || (subPathName.split('/').pop() || '').replace(/_/g, ' ')}</span>
                            {count > 0 && <span className="text-[10px] opacity-50 font-normal">({count})</span>}
                        </Link>
                    )
                })}
            </div>
        )
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
})

export default DynamicNav;
