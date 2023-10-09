import React from "react";

import styles from "./DynamicNav.module.scss"
import Link from "next/link";
import {FloatingDiv} from "/components";

const FETCH_URL = '/api/fs/nav/'

export default async function DynamicNav({pathname, directoryLevels, children}) {
    // const [directoryLevels, setDirectoryLevels] = useState([[]])
    // const [isLoaded, setIsLoaded] = useState(false)

    // if (pathname) {
    //     const url = new URL(pathname, 'http://localhost')
    //     pathname = url.pathname;
    // }

    // useEffect(() => {
    //     setDirectoryLevels(directoryLevels => [[...directoryLevels[0]]])
    //     // Fetch directory structure
    //     fetch(`${FETCH_URL}/${pathname}`)
    //         .then(res => res.json())
    //         .then(response => {
    //             setDirectoryLevels(response.directories)
    //             setIsLoaded(true);
    //         });
    //
    // }, [pathname])

    let subDirectoryOutput = [];
    let directoryOutput = [];
    // if (isLoaded) {
    directoryOutput = (<div key={0} className={styles.linkContainer}>
        {children}
        {directoryLevels[0].map(subPathName => (
            <Link key={subPathName}
                  className={subPathName === pathname ? styles.current : ''}
                  href={subPathName}>{subPathName.split('/').pop()}</Link>)
        )}
    </div>)
    if (directoryLevels.length > 0) {
        for (let level = 1; level < directoryLevels.length; level++) {
            const subDirectoryLevel = directoryLevels[level];
            if (!subDirectoryLevel || subDirectoryLevel.length === 0)
                break;
            subDirectoryOutput.push(
                <div key={level}
                     className={`${styles.linkContainer} ${styles.linkSubContainer}`}>
                    {subDirectoryLevel.map(subPathName => (
                        <Link key={subPathName}
                              className={subPathName === pathname ? styles.current : ''}
                              href={subPathName}>{subPathName.split('/').pop()}</Link>))}
                </div>)
        }
    }

    return <>
        {directoryOutput}
        {subDirectoryOutput}
    </>
    // }

}
