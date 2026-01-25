'use client'

import React, { Suspense, useState, useEffect } from "react";
import { DynamicNav, FloatingDiv, DynamicIndex } from "@/components";
import { SuspenseLoader } from "@client";

export default function MainLayout({
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
        return <div className="flex items-center justify-center min-h-screen"><SuspenseLoader /></div>;
    }

    return (
        <div className="flex-grow flex justify-center w-full px-4 py-8 relative">
            <div className="max-w-[90rem] w-full flex flex-col lg:flex-row gap-8">
                <aside className="lg:w-64 flex-shrink-0">
                    <FloatingDiv containerTag='nav' className="hidden lg:block lg:sticky lg:top-24 w-64">
                        <DynamicNav directory={fileList} className="space-y-1">
                            <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                                Directory
                            </div>
                        </DynamicNav>
                    </FloatingDiv>
                </aside>

                <main className="flex-grow max-w-4xl mx-auto w-full">
                    <Suspense fallback={<SuspenseLoader />}>
                        {children}
                    </Suspense>
                </main>

                {/* Right sidebar for Table of Contents / Dynamic Index */}
                <aside id="sidebar-right" className="hidden lg:block w-80 flex-shrink-0 relative sticky top-24 h-fit p-4">
                    <DynamicIndex mode="sidebar" />
                </aside>
            </div>
        </div>
    );
}
