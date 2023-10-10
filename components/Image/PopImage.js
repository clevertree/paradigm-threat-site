"use client"

import Image from "next/image";
import {useState} from "react";
import styles from './PopImage.module.scss'
import Link from "next/link";


export default function PopImage({children, className, ...props}) {
    const [fullscreen, setFullscreen] = useState(false);
    // if (props.caption) {
    //     const Caption = props.caption;
    //     return <Caption/>;
    // }
    let srcProps = props;
    if (typeof props?.src?.default === "object")
        srcProps = {...props, ...props.src.default};
    else if (typeof props.src === "object")
        srcProps = {...props, ...props.src};
    else if (typeof props.default === "object")
        srcProps = {...props, ...props.default};

    function toggleFullscreen(e) {
        console.log('e', e)
        setFullscreen(!fullscreen)
    }

    const content = (
        <div className={`${styles.container} ${className}`} onClick={toggleFullscreen}>
            <Image
                {...srcProps}

            />
            {children}
        </div>)

    if (fullscreen)
        return <>
            {content}
            <div className={styles.fullscreen} onClick={toggleFullscreen}>
                <Image
                    {...srcProps}
                    className={styles.fullscreenImage}
                />
                {children}
                <Link href={srcProps.src} className="source" target="_blank"
                      rel="noreferrer">Source File: {srcProps.src}</Link>
                <div className={styles.button}>&#10006;</div>
                {/*<div className={styles.button + ' ' + styles.previous} onClick={renderPreviousAsset}>&#8656;</div>*/}
                {/*<div className={styles.button + ' ' + styles.next} onClick={renderNextAsset}>&#8658;</div>*/}
            </div>
        </>
    return content
}

