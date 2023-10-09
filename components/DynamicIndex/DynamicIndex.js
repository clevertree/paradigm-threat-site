"use client"

import React, {useEffect, useRef} from "react";
import ReactDOM from "react-dom/client";
import styles from "./DynamicIndex.module.css"
import {ErrorBoundary} from "@client";

export default function DynamicIndex(props) {
    const container = useRef();

    useEffect(() => {
        updateHeaderList();
    })

    return <ErrorBoundary>
        <ul
            {...props}
            ref={container}>
        </ul>
    </ErrorBoundary>

    function updateHeaderList() {
        const current = container.current;
        const articleElm = current.closest('article, section, body');
        const list = articleElm.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let root = {content: 'root', children: []}, lastByLevel = [root];
        [].forEach.call(list, (headerElm) => {
            if (headerElm.classList.contains('no-index'))
                return;
            let {nodeName, id, textContent} = headerElm;
            if (!id)
                id = headerElm.id = (`${nodeName}_${textContent}`).toLowerCase().replace(/[^\w\-]+/g, '_');
            const level = parseInt(nodeName.substring(1, 2));
            const liProps = {id, content: textContent, children: [], headerElm, level};
            lastByLevel[level] = liProps;

            // Erase disconnected levels
            lastByLevel = lastByLevel.splice(0, level + 1);

            // Find parent
            let target;
            for (let i = level - 1; i >= 0; i--) {
                target = lastByLevel[i];
                if (target)
                    break;
            }

            target.children.push(liProps);
            // headerElm.classList.add('header-target');
            headerElm.ondblclick = e => onClick(e, id);
        });
        current.reactContainer = current.reactContainer || ReactDOM.createRoot(current);
        const render = root.children.map((child, i) => renderHeaderChild(child, i));
        current.reactContainer.render(render);
    }

    function renderHeaderChild({content, id, children, headerElm, level}, key) {
        return [
            <li className={'h' + level} key={key + 'li'}>
                <a
                    onClick={e => onClick(e, id)}
                    href={'#' + id}>{content}</a>
            </li>,
            (children && children.length > 0 ? <ul key={key + 'ul'}>
                {children.map((child, i) => renderHeaderChild(child, i))}
            </ul> : null)
        ];
    }

    function onClick(e, id) {
        const {current} = container;
        const articleElm = current.closest('article, section, body');
        const hash = '#' + id;
        const headerElm = articleElm.querySelector(`*[id='${id}']`);
        e.preventDefault();
        window.history.pushState({}, '', hash);
        headerElm.scrollIntoView({block: "center", behavior: 'smooth'})
        headerElm.classList.add('highlighted')
        setTimeout(() => headerElm.classList.remove('highlighted'), 4000);
    }
}
