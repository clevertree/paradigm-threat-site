import type {Metadata} from 'next'
import React, {Suspense} from "react";
import Link from "next/link";
import {DynamicNav, FloatingDiv} from "@/components";
import HeaderImg from "./site/header.png";
import Directory from "./directory.json"
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from "@vercel/speed-insights/next"

import LoadingScreen from "./site/loading"

/** Styles **/
import './site/globals.scss'
import styles from './site/layout.module.scss';

export const metadata: Metadata = {
    metadataBase: new URL(`${process.env.NEXT_PUBLIC_METADATA_URL}`),
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
            <img src={HeaderImg.src} alt="Header Logo"/>
        </Link>
    </header>


    <FloatingDiv containerTag='nav' className={styles.navContainer}>
        <DynamicNav directory={Directory} className={styles.linkContainer}>
            <Link href="/search">🔍</Link>
            <Link href="/">home</Link>
            <Link href="https://chat.paradigmthreat.net">chat</Link>
            <Link href="https://www.bitchute.com/channel/paradigmthreat">videos</Link>
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
            [<a href="https://github.com/clevertree/paradigm-threat-site">git repository</a>]
        </div>
    </footer>

    <Analytics/>
    <SpeedInsights/>
    </body>
    </html>)
}
