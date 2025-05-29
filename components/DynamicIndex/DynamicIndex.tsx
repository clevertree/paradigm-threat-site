'use client'

import React, {useEffect, useRef, useState} from 'react'
import styles from './DynamicIndex.module.css'

interface DynamicIndexProps {

}


interface HeaderList extends Array<HeaderEntry> {

}

interface HeaderEntry {
    id: string,
    title: string,
    children: HeaderList
}

export default function DynamicIndex(props: DynamicIndexProps) {
    const container = useRef<HTMLUListElement>(null)
    const [headerList, setHeaderList] = useState<HeaderList>([])

    useEffect(() => {
        const {hash} = window.location
        const current = container.current
        if (!current)
            throw new Error("DynamicIndex container not found");
        const headerList: HeaderList = generateHeaderList(current, hash ? hash.substring(1) : undefined)
        setHeaderList(headerList);
        return () => {
            setHeaderList([])
        }
    }, [])


    return (<ul
        className={styles.container}
        {...props}
        ref={container}
    >
        {headerList.map(headerEntry => renderHeaderChild(headerEntry, 1))}
    </ul>)

    function renderHeaderChild({title, id, children,}: HeaderEntry, level: number) {
        return [
            <li className={'h' + level} key={id + '_li'}>
                <a
                    onClick={e => onClick(e.nativeEvent || e, id)}
                    href={'#' + id}
                >{title}
                </a>
            </li>,
            (children && children.length > 0
                ? (
                    <ul key={id + '_ul'}>
                        {children.map((child, i) => renderHeaderChild(child, level + 1))}
                    </ul>
                )
                : null)
        ]
    }
}


function generateHeaderList(container: HTMLUListElement, scrollToHash?: string) {
    const articleElm = container.closest('article, section, body')
    if (!articleElm)
        throw new Error("DynamicIndex articleElm not found");
    const list = articleElm.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const root: HeaderEntry = {id: 'root', title: 'root', children: []}
    let lastByLevel: HeaderList = [root];
    [].forEach.call(list, (headerElm: HTMLHeadingElement) => {
        if (headerElm.classList.contains('no-index')) {
            return
        }
        let {nodeName, id, textContent} = headerElm
        if (!id) {
            id = headerElm.id = 'header:'+(`${textContent}`).toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^\w-]+/g, '')
        }
        const level = parseInt(nodeName.substring(1, 2))
        const headerEntry: HeaderEntry = {id, title: textContent + '', children: []}
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

function onClick(e: MouseEvent, id: string) {
    e.preventDefault()
    const target = e.target as HTMLHeadingElement;
    const articleElm = target.closest('article, section, body') || document.body;
    const hash = '#' + id
    const headerElm = articleElm.querySelector(`*[id='${id}']`) as HTMLHeadingElement
    if (!headerElm)
        throw new Error("Header Element not found: " + id)
    scrollToHeader(headerElm)
    window.history.pushState({}, '', hash)
}

function scrollToHeader(headerElm: HTMLHeadingElement, behavior?: ScrollBehavior) {
    headerElm.scrollIntoView({block: 'center', behavior})
    const eventHandler = () => {
        headerElm.classList.remove('text-highlighted')
        headerElm.removeEventListener('animationend', eventHandler)
    }
    headerElm.addEventListener('animationend', eventHandler)
    headerElm.classList.add('text-highlighted')
}