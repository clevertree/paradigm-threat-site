'use client'

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { DynamicNav, FloatingDiv, ThemeToggle, Navbar, ImageGalleryProvider, DynamicIndex } from "@/components";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"

/** Styles **/
import './site/globals.scss'
import { SuspenseLoader } from "@client";

export default function RootLayout(
    {
        children
    }: {
        children: React.ReactNode
    }) {

    const [fileList, setFileList] = useState<string[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
        const baseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';
        fetch(`${baseUrl}/index.json`)
            .then(res => res.json())
            .then(data => setFileList(data))
            .catch(() => setFileList([]));
    }, []);

    if (!isHydrated) {
        return (
            <html lang="en" className="dark font-['Titillium_Web']" suppressHydrationWarning>
                <head>
                    <title>Paradigm Threat</title>
                    <link rel="icon" type="image/svg+xml" href="/site/favicon.svg" />
                </head>
                <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300">
                    <div className="flex items-center justify-center min-h-screen">
                        <SuspenseLoader />
                    </div>
                </body>
            </html>
        );
    }

    return (
        <html lang="en" className="dark font-['Titillium_Web']" suppressHydrationWarning>
            <head>
                <title>Paradigm Threat</title>
                <link rel="icon" type="image/svg+xml" href="/site/favicon.svg" />
                <script dangerouslySetInnerHTML={{
                    __html: `try{if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(_){}`,
                }} />
            </head>
            <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300">
                <Navbar fileList={fileList} />

                <ImageGalleryProvider>
                    {children}
                </ImageGalleryProvider>

                <footer className="w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-auto">
                    <div className="max-w-7xl mx-auto px-4 text-center space-y-6">
                        <div className="flex justify-center gap-8 text-slate-600 dark:text-slate-400">
                            <Link href="/search" className="hover:text-slate-900 dark:hover:text-white transition-colors">Search</Link>
                            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
                            <Link href="/chat" className="hover:text-slate-900 dark:hover:text-white transition-colors">Chat</Link>
                            <Link href="https://www.bitchute.com/channel/paradigmthreat" target="_blank" className="hover:text-slate-900 dark:hover:text-white transition-colors">Videos</Link>
                        </div>
                        <div className="text-slate-500 text-sm">
                            Created by <a href="https://clevertree.net/" className="text-blue-500 hover:underline font-semibold">Ari Asulin</a>
                        </div>
                        <div className="flex justify-center gap-4 text-xs text-slate-400">
                            <a href="https://github.com/clevertree/paradigm-threat-site" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">[git repository]</a>
                        </div>
                    </div>
                </footer>

                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    )
}
