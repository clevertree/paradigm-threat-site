'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useArticleNav } from '@/components/ArticleNav/ArticleNav'

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
    const { prev, next } = useArticleNav()

    useEffect(() => {
        const { hash } = window.location
        const current = container.current
        if (!current) return;

        const updateIndex = () => {
            try {
                const list: HeaderList = generateHeaderList(current, hash ? hash.substring(1) : undefined)
                setHeaderList(list);
            } catch {
                // main or headers not ready yet
            }
        }

        // Delay to ensure MDX/content is rendered (MDXRemote can be async)
        const timer = setTimeout(updateIndex, 350);

        const handleContentUpdate = () => {
            // MDX may still be rendering; retry with increasing delay
            const retry = (attempt: number) => {
                const delay = 100 + attempt * 150;
                setTimeout(() => {
                    try {
                        const list = generateHeaderList(current, hash ? hash.substring(1) : undefined);
                        if (list.length > 0 || attempt >= 2) setHeaderList(list);
                        else retry(attempt + 1);
                    } catch {
                        if (attempt < 2) retry(attempt + 1);
                    }
                }, delay);
            };
            retry(0);
        };

        window.addEventListener('dynamic-index-update', handleContentUpdate);

        // Rescan when headings appear (MDX renders asynchronously)
        const main = document.querySelector('main');
        let debounceTimer: ReturnType<typeof setTimeout>;
        const obs = main
            ? new MutationObserver(() => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(handleContentUpdate, 80);
            })
            : null;
        if (obs && main) obs.observe(main, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            clearTimeout(debounceTimer!);
            window.removeEventListener('dynamic-index-update', handleContentUpdate);
            obs?.disconnect();
            setHeaderList([]);
        };
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
            <li className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 px-2 flex items-center justify-between gap-2">
                <span>Table of Contents</span>
                {(prev || next) && (
                    <span className="flex items-center gap-1 shrink-0">
                        {prev && (
                            <Link
                                href={`/${prev.path}`}
                                title={prev.title}
                                className="text-[9px] px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-blue-500/20 dark:hover:bg-blue-500/20 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
                            >
                                ← Prev
                            </Link>
                        )}
                        {next && (
                            <Link
                                href={`/${next.path}`}
                                title={next.title}
                                className="text-[9px] px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-700/80 hover:bg-blue-500/20 dark:hover:bg-blue-500/20 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
                            >
                                Next →
                            </Link>
                        )}
                    </span>
                )}
            </li>
            {headerList.map(headerEntry => renderHeaderChild(headerEntry, 1))}
        </ul>
    )

    function renderHeaderChild({ title, id, children, }: HeaderEntry, level: number) {
        return (
            <React.Fragment key={id}>
                <li className="list-none">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTocClick(id);
                        }}
                        className={`block w-full text-left px-3 py-2 rounded-xl hover:bg-blue-600/10 dark:hover:bg-blue-500/20 transition-all duration-200 text-blue-600 dark:text-blue-400 no-underline group cursor-pointer border-0 bg-transparent ${level === 1 ? 'font-bold text-sm mb-1 bg-white/50 dark:bg-white/5 shadow-sm border border-slate-200/50 dark:border-white/5' : 'text-[11px] py-0 opacity-80 hover:opacity-100'}`}
                    >
                        <span className="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-200">
                            <span className="truncate">{title}</span>
                        </span>
                    </button>
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
            id = `${textContent}`.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^\w-]+/g, '')
        }

        // Deduplicate IDs even when pre-assigned (e.g. by MDX renderer),
        // to prevent duplicate React keys when the same heading appears twice.
        if (usedIds.has(id)) {
            const baseId = id
            let counter = 1
            while (usedIds.has(`${baseId}_${counter}`)) {
                counter++
            }
            id = `${baseId}_${counter}`
        }
        usedIds.add(id)
        headerElm.id = id

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
        headerElm.ondblclick = () => handleTocClick(id)

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

function handleTocClick(id: string) {
    const headerElm = document.getElementById(id) as HTMLHeadingElement | null
    if (!headerElm) return

    scrollToHeader(headerElm)
    // Do NOT update URL hash: Next.js App Router re-renders the entire app on hash change
    // (github.com/vercel/next.js/issues/34729), which resets scroll before it completes.
    // Deep links with #section still work on initial load via scrollToHash in generateHeaderList.
}

function getScrollParent(el: HTMLElement): Element | null {
    let parent = el.parentElement
    while (parent && parent !== document.documentElement) {
        const style = getComputedStyle(parent)
        const overflowY = style.overflowY || style.overflow
        if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && parent.scrollHeight > parent.clientHeight) {
            return parent
        }
        parent = parent.parentElement
    }
    return null
}

function scrollToHeader(headerElm: HTMLHeadingElement, behavior: ScrollBehavior = 'smooth') {
    const scrollParent = getScrollParent(headerElm)
    const offset = 24
    if (scrollParent) {
        const rect = headerElm.getBoundingClientRect()
        const parentRect = scrollParent.getBoundingClientRect()
        const top = scrollParent.scrollTop + rect.top - parentRect.top - offset
        scrollParent.scrollTo({ top: Math.max(0, top), behavior })
    } else {
        headerElm.scrollIntoView({ block: 'start', behavior })
    }
    const eventHandler = () => {
        headerElm.classList.remove('text-highlighted')
        headerElm.removeEventListener('animationend', eventHandler)
    }
    headerElm.addEventListener('animationend', eventHandler)
    headerElm.classList.add('text-highlighted')
}