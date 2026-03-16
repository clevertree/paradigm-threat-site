'use client'

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface DynamicNavProps {
    children?: React.ReactNode,
    className: string,
    directory: Record<string, any>

    [key: string]: any,
}

/** Returns paths that should be expanded to reveal currentPath (ancestors only) */
function getPathsToCurrent(currentPath: string | null): Set<string> {
    if (!currentPath) return new Set()
    const parts = currentPath.split('/').filter(Boolean)
    const expanded = new Set<string>()
    let path = ''
    for (let i = 0; i < parts.length; i++) {
        path += (path ? '/' : '/') + parts[i]
        expanded.add(path)
    }
    return expanded
}

const DynamicNav = memo(function DynamicNav({ directory: inputDirectory, children, className }: DynamicNavProps) {
    const currentPath = usePathname()

    const directory = useMemo(() => {
        if (!inputDirectory) return {}

        if (Array.isArray(inputDirectory)) {
            const tree: Record<string, any> = {}
            inputDirectory.forEach(path => {
                if (path === '/' || !path) return
                const normalizedPath = path.startsWith('/') ? path : '/' + path
                const parts = normalizedPath.split('/').filter(Boolean)

                let current = tree
                parts.forEach((part: string, index: number) => {
                    if (index === parts.length - 1 && part.includes('.')) return
                    if (!current[part]) current[part] = {}
                    current = current[part]
                })
            })
            return tree
        } else {
            const cleanTree = (node: any): any => {
                const result: any = {}
                Object.keys(node).forEach(key => {
                    if (key === '_count') {
                        result[key] = node[key]
                    } else if (node[key] !== null && typeof node[key] === 'object' && '_count' in node[key]) {
                        result[key] = cleanTree(node[key])
                    }
                })
                return result
            }
            return cleanTree(inputDirectory)
        }
    }, [inputDirectory])

    const defaultExpanded = useMemo(() => getPathsToCurrent(currentPath), [currentPath])

    const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded)

    useEffect(() => {
        queueMicrotask(() => setExpanded(new Set(getPathsToCurrent(currentPath))))
    }, [currentPath])

    const toggle = useCallback((path: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }, [])

    const expandToCurrent = useCallback(() => {
        setExpanded(new Set(defaultExpanded))
    }, [defaultExpanded])

    const collapseAll = useCallback(() => {
        setExpanded(new Set())
    }, [])

    const childKeys = Object.keys(directory).filter(k => k !== '_count' && k !== '_version')

    const INDENT_PER_LEVEL = 16

    function renderItem(parentPath: string, name: string, data: any, depth: number): React.ReactNode {
        const fullPath = parentPath + name
        const subKeys = data && typeof data === 'object'
            ? Object.keys(data).filter(k => k !== '_count')
            : []
        const hasChildren = subKeys.length > 0
        const isExpanded = expanded.has(fullPath)
        const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + '/')
        const count = data?._count ?? 0
        const title = data?._title ?? (name.split('/').pop() ?? '').replace(/_/g, ' ')
        const leftPad = depth * INDENT_PER_LEVEL

        return (
            <div key={fullPath} className="flex flex-col">
                <div
                    className={`
                        flex items-center gap-0.5 rounded-lg text-sm transition-colors min-w-0
                        ${isActive
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
                    `}
                    style={{ paddingLeft: leftPad }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); toggle(fullPath) }}
                            className="p-0.5 -m-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 shrink-0 w-[22px] flex items-center justify-center"
                            aria-expanded={isExpanded}
                        >
                            {isExpanded
                                ? <ChevronDown size={14} className="shrink-0" />
                                : <ChevronRight size={14} className="shrink-0" />}
                        </button>
                    ) : (
                        <span className="w-[18px] shrink-0 flex-shrink-0" aria-hidden />
                    )}
                    <Link
                        prefetch={false}
                        href={fullPath}
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 py-1.5 pr-2 pl-0.5"
                    >
                        <span className="truncate">{title}</span>
                        {count > 0 && <span className="text-[10px] opacity-50 font-normal shrink-0">({count})</span>}
                    </Link>
                </div>
                {hasChildren && isExpanded && (
                    <div className="space-y-0.5">
                        {subKeys.map(sub => renderItem(fullPath + '/', sub, data[sub], depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`space-y-1 ${className || ''}`}>
            {children}
            <div className="flex items-center gap-1 pb-2">
                <button
                    type="button"
                    onClick={collapseAll}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded"
                >
                    Collapse all
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                    type="button"
                    onClick={expandToCurrent}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded"
                >
                    Expand to current
                </button>
            </div>
            <div className="space-y-0.0">
                {childKeys.map(key => renderItem('/', key, directory[key], 0))}
            </div>
        </div>
    )
})

export default DynamicNav
