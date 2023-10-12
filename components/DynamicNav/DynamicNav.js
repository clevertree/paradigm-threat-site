"use client";

import React from "react";

import styles from "./DynamicNav.module.scss"
import Link from "next/link";
import {usePathname} from "next/navigation";


export default function DynamicNav({directory, children}) {
    const currentPath = usePathname();

    function renderDirectory(directory, currentPath, children = null) {
        return <div key={currentPath} className={styles.linkContainer}>
            {children}
            {Object.keys(directory).map(subPathName => {
                const relativeSubPathName = currentPath + subPathName
                return (
                    <Link key={subPathName}
                          className={relativeSubPathName === currentPath ? styles.current : ''}
                          href={relativeSubPathName}>{subPathName.split('/').pop()}
                    </Link>

                )
            })}
        </div>
    }

    if (!directory)
        return null

    let content = [
        renderDirectory(directory, '/', children)
    ];
    if (currentPath) {
        const splitPath = currentPath.split('/');
        let directoryPointer = directory;
        let iSubPath = '/'
        for (const subPath of splitPath) {
            if (directoryPointer[subPath]
                && Object.keys(directoryPointer[subPath]).length > 0) {
                directoryPointer = directoryPointer[subPath]
                iSubPath += subPath + '/';
                content.push(renderDirectory(directoryPointer, iSubPath))
            }
        }
    }
    return content;
}
