import type {Metadata} from 'next'
import React, {Suspense} from "react";
import Link from "next/link";
import Image from "next/image";
import {DynamicNav, FloatingDiv} from "@/components";
import HeaderImg from "./site/header.png";
import Directory from "./directory.json"

import LoadingScreen from "./site/loading"

/** Styles **/
import './site/globals.css'
import styles from './site/layout.module.scss';

export const metadata: Metadata = {
    title: 'Paradigm Threat',
    description: 'Conspiracy Repository',
}


export default async function RootLayout(
    {
        children
    }: {
        children: React.ReactNode
    }) {

    return (<html lang="en">
    <head/>
    <body>
    <header>
        <Link href="/">
            <Image priority src={HeaderImg} alt="Header Logo"/>
        </Link>
    </header>


    <FloatingDiv containerElm='nav' className={styles.navContainer}>
        <DynamicNav directory={Directory} className={styles.linkContainer}>
            <Link href="/search">🔍</Link>
            <Link href="/">home</Link>
            <Link href="https://chat.paradigmthreat.net">chat</Link>
            <Link href="https://video.paradigmthreat.net">videos</Link>
        </DynamicNav>
    </FloatingDiv>

    <Suspense fallback={<LoadingScreen/>}>
        <article>
            {children}
        </article>
    </Suspense>

    <footer>
        <div>created by <a href="https://clevertree.net/">Ari Asulin</a></div>
        {/*<hitCounter></hitCounter>*/}
        <div>
            [<a href="https://git.pthreat.co/ari/paradigm-threat-site">git repository</a>]
        </div>
    </footer>
    </body>
    </html>)
}
