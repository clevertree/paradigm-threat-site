'use client'

import React, { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { DynamicNav, FloatingDiv, DynamicIndex, useFiles } from "@/components";
import { SuspenseLoader } from "@client";

export default function MainLayout({
    children
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname();
    const { fileList } = useFiles();
    // Hide FloatingDiv's Back to top on article pages (2+ path segments) where the Play FAB handles scroll-to-top
    const hideFloatingButtons = pathname ? pathname.split('/').filter(Boolean).length >= 2 : false;

    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    if (!isHydrated) {
        return <div className="flex items-center justify-center min-h-screen"><SuspenseLoader /></div>;
    }

    return (
        <div className="flex-grow flex justify-center w-full px-4 py-8 relative">
            <div className="max-w-[90rem] w-full flex flex-col lg:flex-row gap-8">
                <aside className="lg:w-64 flex-shrink-0">
                    <FloatingDiv containerTag='nav' className="hidden lg:block lg:sticky lg:top-24 w-64" hideFloatingButtons={hideFloatingButtons}>
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

                {/* Right sidebar for Table of Contents - fixed so it stays in view when scrolling */}
                <aside id="sidebar-right" className="hidden lg:block w-80 flex-shrink-0 p-4" aria-label="Table of contents">
                    <div className="lg:fixed lg:right-8 lg:top-24 lg:w-72 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                        <DynamicIndex mode="sidebar" />
                    </div>
                </aside>
            </div>
        </div>
    );
}
