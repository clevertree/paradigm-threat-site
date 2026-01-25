'use client'

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RemoteMDX } from '@/components/RemoteMDX';
import { PopImage } from '@/components';
import Link from 'next/link';
import matter from 'gray-matter';
import { SuspenseLoader } from "@client";

export default function CatchAllPage() {
    const params = useParams();
    const [content, setContent] = useState<string | null>(null);
    const [basePath, setBasePath] = useState('');
    const [unusedImages, setUnusedImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filesIndex, setFilesIndex] = useState<string[]>([]);
    const [directFiles, setDirectFiles] = useState<string[]>([]);
    const [subDirs, setSubDirs] = useState<string[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [mds, setMds] = useState<string[]>([]);
    const [mdContents, setMdContents] = useState<Record<string, {title: string, content: string}>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';
        let slug: string[] = [];
        if (params.slug) {
            slug = Array.isArray(params.slug) ? params.slug : [params.slug];
        }
        const path = slug.join('/');

        let isMounted = true;
        const abortController = new AbortController();

        const loadPage = async () => {
            try {
                console.log('[DEBUG] Loading page for path:', path);
                
                const indexUrl = `${baseUrl}/index.json`;
                console.log('[DEBUG] Fetching from:', indexUrl);
                
                const indexResponse = await fetch(indexUrl, { signal: abortController.signal });
                
                if (!indexResponse.ok) {
                    throw new Error(`Failed to fetch index: ${indexResponse.status}`);
                }
                
                const index = await indexResponse.json();
                
                if (!isMounted) return;
                
                if (!Array.isArray(index)) {
                    throw new Error(`Index is not an array: ${typeof index}`);
                }
                
                setFilesIndex(index);

                let targetPath = '';
                let fileContent = null;

                // 1. Try to load as a direct file (if path ends in .md/.mdx)
                if (path && (path.endsWith('.md') || path.endsWith('.mdx'))) {
                    if (path.includes('.auto.md')) {
                        if (isMounted) {
                            setContent('deprecated');
                            setLoading(false);
                        }
                        return;
                    }
                    try {
                        const response = await fetch(`${baseUrl}/${path}`, { signal: abortController.signal });
                        if (response.ok) {
                            fileContent = await response.text();
                            targetPath = path;
                        }
                    } catch (err) {
                        console.warn('Failed to load direct file:', err);
                    }
                } 
                // 2. Otherwise try accessing it as a folder with page.md
                else {
                    const p = path ? `${path}/page.md` : 'page.md';
                    try {
                        const response = await fetch(`${baseUrl}/${p}`, { signal: abortController.signal });
                        if (response.ok) {
                            fileContent = await response.text();
                            targetPath = p;
                        } else {
                            // Only log if it's a real error, 404 is expected for directories without page.md
                            if (response.status !== 404) {
                                console.log('[DEBUG] Page load response:', response.status);
                            }
                        }
                    } catch (err) {
                         // Ignore abort errors
                         if ((err as Error).name !== 'AbortError') {
                             console.warn('Failed to load page.md:', err);
                         }
                    }
                }

                if (fileContent) {
                    // CASE A: Render Markdown Content
                    console.log('[DEBUG] Content found, rendering MDX');
                    const { content: mdxSource } = matter(fileContent);
                    const calcBasePath = targetPath.includes('/') ? targetPath.split('/').slice(0, -1).join('/') : '';
                    
                    if (isMounted) {
                        setBasePath(calcBasePath);
                        setContent(mdxSource);
                        
                        // Clear directory state to ensure we don't show mixed content
                        setDirectFiles([]);
                        setSubDirs([]);
                        setImages([]);
                        setMds([]);
                    }

                    // Find gallery images in the same folder
                    const subFiles = index.filter((f: string) => f.startsWith(calcBasePath + (calcBasePath ? '/' : '')));
                    const relativeFiles = subFiles.map((f: string) => f.slice(calcBasePath ? calcBasePath.length + 1 : 0));
                    const allImagesInDir = relativeFiles.filter((f: string) => !f.includes('/') && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f));

                    const unused = allImagesInDir.filter((img: string) => {
                        const escapedImg = img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`[\\(/\\s"'.]${escapedImg}([\\?\\s"')]|$)`, 'i');
                        return !regex.test(mdxSource);
                    });
                    
                    if (isMounted) setUnusedImages(unused);
                } else {
                    // CASE B: Directory Listing
                    console.log('[DEBUG] No content file found, building directory listing');
                    
                    // Filter files that are inside this directory
                    const prefix = path ? path + '/' : '';
                    const subFiles = index.filter((f: string) => f.startsWith(prefix));
                    
                    // console.log(`[DEBUG] Found ${subFiles.length} files under ${prefix}`);

                    // Get relative paths
                    const relativeFiles = subFiles.map((f: string) => f.slice(prefix.length));

                    // Direct files in this directory (no slashes)
                    const dirFiles = relativeFiles.filter((f: string) => !f.includes('/')).sort();
                    
                    // Subdirectories (first part of path before slash)
                    const dirsSet = new Set<string>();
                    relativeFiles.forEach((f: string) => {
                        if (f.includes('/')) {
                            dirsSet.add(f.split('/')[0]);
                        }
                    });
                    const dirs = Array.from(dirsSet).sort();

                    console.log(`[DEBUG] Found ${dirFiles.length} files and ${dirs.length} subdirectories`);

                    if (isMounted) {
                        setContent(null); // Ensure no content is shown
                        setDirectFiles(dirFiles);
                        setSubDirs(dirs);
                    }

                    const imgFiles = dirFiles.filter((f: string) => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f));
                    const mdFiles = dirFiles.filter((f: string) => f.endsWith('.md') && f !== 'page.md' && !f.endsWith('.auto.md'));
                    
                    if (isMounted) {
                        setImages(imgFiles);
                        setMds(mdFiles);
                    }

                    // Pre-load titles for markdown files in list
                    const contents: Record<string, {title: string, content: string}> = {};
                    await Promise.all(mdFiles.map(async (f) => {
                        if (!isMounted) return;
                        const fullPath = `${prefix}${f}`;
                        try {
                            const response = await fetch(`${baseUrl}/${fullPath}`, { signal: abortController.signal });
                            if (response.ok) {
                                const fileContent = await response.text();
                                const { content: mdxSource, data: frontMatter } = matter(fileContent);
                                contents[f] = {
                                    title: frontMatter.title || f.replace(/_/g, ' ').replace('.md', ''),
                                    content: mdxSource
                                };
                            }
                        } catch (e) {
                             // quiet fail
                        }
                    }));
                    
                    if (isMounted) setMdContents(contents);
                }
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
                    console.error('[ERROR] Load failed:', e);
                    if (isMounted) setError(String(e));
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadPage();
        
        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, [params.slug]);

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><SuspenseLoader /></div>;
    }

    let slugArray: string[] = [];
    if (params.slug) {
        slugArray = Array.isArray(params.slug) ? params.slug : [params.slug];
    }
    const path = slugArray.join('/');

    if (content === 'deprecated') {
        return <div className="text-center py-20 text-slate-500 italic">This autogenerated page has been deprecated. Please browse the directory instead.</div>;
    }

    if (content) {
        return (
            <div className="space-y-12">
                <article className="prose prose-slate dark:prose-invert max-w-none">
                    <RemoteMDX source={content} basePath={basePath} />
                </article>

                {unusedImages.length > 0 && (
                    <div className="space-y-8 pt-12 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-8 bg-purple-500 rounded-full" />
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gallery</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                            {unusedImages.map(img => (
                                <div key={img} className="group aspect-square relative transition-transform duration-300 hover:-translate-y-1">
                                    <PopImage
                                        src={img}
                                        basePath={basePath}
                                        w={400}
                                        className="w-full h-full object-cover rounded-xl shadow-sm border border-slate-100 dark:border-slate-900"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Directory listing view
    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-4xl font-extrabold mb-8 capitalize tracking-tight text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">
                    {path.split('/').pop() || 'Home'}
                </h1>
                
                {directFiles.length === 0 && subDirs.length === 0 ? (
                     <div className="text-center py-20">
                        <p className="text-slate-500 mb-4">No content found for this path</p>
                        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
                        <Link href="/" className="text-blue-500 hover:underline">
                            Back to Home
                        </Link>
                    </div>
                ) : (
                    <>
                        {subDirs.length > 0 && (
                            <div className="space-y-6 mb-16">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Directories</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subDirs.map(dir => (
                                        <Link
                                            key={dir}
                                            href={`/${path ? path + '/' : ''}${dir}`}
                                            className="group flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 hover:bg-blue-600 dark:hover:bg-blue-600 p-4 rounded-xl transition-all duration-200 shadow-sm border border-slate-200 dark:border-slate-800"
                                        >
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-white transition-colors">
                                                📁 {dir.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-slate-400 group-hover:text-white/80 transition-colors">→</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mds.length > 0 && (
                            <div className="space-y-16 mb-16">
                                {mds.map(f => {
                                    const mdData = mdContents[f];
                                    if (!mdData) return null; // Wait for data to load
                                    const fullPath = `${path ? path + '/' : ''}${f}`;
                                    return (
                                        <section key={f} className="relative">
                                            <div className="flex items-center gap-3 mb-6 group">
                                                <div className="w-1 h-8 bg-blue-500 rounded-full" />
                                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                                                    {mdData.title}
                                                </h2>
                                                <Link href={`/${fullPath}`} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:text-blue-500">
                                                    #link
                                                </Link>
                                            </div>
                                            <article className="prose prose-slate dark:prose-invert max-w-none bg-white dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
                                                <RemoteMDX source={mdData.content} basePath={path} />
                                            </article>
                                        </section>
                                    );
                                })}
                            </div>
                        )}

                        {images.length > 0 && (
                            <div className="space-y-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1 h-8 bg-purple-500 rounded-full" />
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gallery</h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {images.map(img => (
                                        <div key={img} className="group aspect-square relative transition-transform duration-300 hover:-translate-y-1">
                                            <PopImage
                                                src={img}
                                                basePath={path}
                                                w={400}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
