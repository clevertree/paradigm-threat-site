'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

interface DynamicIndexProps {
    currentPath?: string;
    mode?: 'sidebar' | 'inline';
}

interface HeaderList extends Array<HeaderEntry> {
}

interface HeaderEntry {
    id: string;
    title: string;
    children: HeaderList;
}

export default function DynamicIndex({ mode = 'inline', ...props }: DynamicIndexProps) {
    const container = useRef<HTMLUListElement>(null)
    const [headerList, setHeaderList] = useState<HeaderList>([])
    const pathname = usePathname()

    useEffect(() => {
        const { hash } = window.location
        const current = container.current
        if (!current) return;

        // Small delay to ensure MDX/Content is rendered if this is the sidebar instance
        // or after a client-side navigation
        const timer = setTimeout(() => {
            const list: HeaderList = generateHeaderList(current, hash ? hash.substring(1) : undefined)
            setHeaderList(list);
        }, 200);

        return () => {
            clearTimeout(timer);
            setHeaderList([])
        }
    }, [pathname])

    if (headerList.length === 0) {
        return <ul ref={container} className="hidden" />
    }

    return (
        <ul
            className={`dynamic-index-container space-y-0 p-5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl transition-all duration-300 shadow-xl overflow-y-auto max-h-[calc(100vh-10rem)] ${mode === 'sidebar'
                ? 'hidden lg:block w-full'
                : 'block lg:hidden mb-8 max-w-2xl'
                }`}
            ref={container}
        >
            <li className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 px-2">Table of Contents</li>
            {headerList.map(headerEntry => renderHeaderChild(headerEntry, 1))}
        </ul>
    )

    function renderHeaderChild({ title, id, children, }: HeaderEntry, level: number) {
        return (
            <React.Fragment key={id}>
                <li className="list-none">
                    <a
                        onClick={e => {
                            e.preventDefault();
                            onClick(e, id);
                        }}
                        href={'#' + id}
                        className={`block px-3 rounded-xl hover:bg-blue-600/10 dark:hover:bg-blue-500/20 transition-all duration-200 text-blue-600 dark:text-blue-400 no-underline group ${level === 1 ? 'font-bold text-sm mb-1 bg-white/50 dark:bg-white/5 shadow-sm border border-slate-200/50 dark:border-white/5' : 'text-[11px] py-0 opacity-80 hover:opacity-100'}`}
                    >
                        <span className="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-200">
                            <span className="truncate">{title}</span>
                        </span>
                    </a>
                </li>
                {children && children.length > 0 && (
                    <ul className="list-none ml-4 my-1 border-l border-slate-200 dark:border-slate-800/50 space-y-0.5">
                        {children.map(child => renderHeaderChild(child, level + 1))}
                    </ul>
                )}
            </React.Fragment>
        )
    }
}


function generateHeaderList(container: HTMLUListElement, scrollToHash?: string) {
    const contentElm = document.querySelector('main') || container.closest('article, section, body')
    if (!contentElm)
        throw new Error("DynamicIndex contentElm not found");
    const list = contentElm.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const root: HeaderEntry = { id: 'root', title: 'root', children: [] }
    let lastByLevel: HeaderList = [root];
    const usedIds = new Set<string>();

    [].forEach.call(list, (headerElm: HTMLHeadingElement) => {
        if (headerElm.classList.contains('no-index')) {
            return
        }
        let { nodeName, textContent } = headerElm
        let id = headerElm.id

        if (!id) {
            const baseId = `${textContent}`.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^\w-]+/g, '')
            id = baseId
            let counter = 1
            while (usedIds.has(id)) {
                id = `${baseId}_${counter++}`
            }
            headerElm.id = id
        }
        usedIds.add(id)

        const level = parseInt(nodeName.substring(1, 2))
        const headerEntry: HeaderEntry = { id, title: textContent + '', children: [] }
        lastByLevel[level] = headerEntry

        // Erase disconnected levels
        lastByLevel = lastByLevel.splice(0, level + 1)

        // Find parent
        let target: HeaderEntry | undefined = undefined;
        for (let i = level - 1; i >= 0; i--) {
            target = lastByLevel[i]
            if (target) {
                break
            }
        }
        if (!target)
            throw new Error("Parent entry not found");
        target.children.push(headerEntry);

        // target.children.push(headerEntry)
        // headerElm.classList.add('header-target');
        headerElm.ondblclick = e => onClick(e, id)

        if (scrollToHash) {
            if (id === scrollToHash) {
                scrollToHeader(headerElm, 'auto')
            }
        }
    })
    return root.children
    // current.reactContainer = current.reactContainer || ReactDOM.createRoot(current)
    // const render = root.children.map((child, i) => renderHeaderChild(child, i))
    // current.reactContainer.render(render)
}

function onClick(e: React.MouseEvent | MouseEvent, id: string) {
    const target = e.target as HTMLElement;
    const articleElm = target?.closest('article, section, body') || document.body;
    const hash = '#' + id
    const headerElm = articleElm.querySelector(`*[id='${id}']`) as HTMLHeadingElement
    if (!headerElm) return; // Silent fail if header not found

    scrollToHeader(headerElm)
    window.history.pushState({}, '', hash)
}

function scrollToHeader(headerElm: HTMLHeadingElement, behavior: ScrollBehavior = 'smooth') {
    headerElm.scrollIntoView({ block: 'center', behavior })
    const eventHandler = () => {
        headerElm.classList.remove('text-highlighted')
        headerElm.removeEventListener('animationend', eventHandler)
    }
    headerElm.addEventListener('animationend', eventHandler)
    headerElm.classList.add('text-highlighted')
}