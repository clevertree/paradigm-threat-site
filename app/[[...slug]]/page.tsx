import React from 'react';
import { getFilesIndex, getRemoteFile } from '@/server/remoteFiles';
import { RemoteMDX } from '@/components/RemoteMDX';
import { PopImage } from '@/components';
import Link from 'next/link';
import matter from 'gray-matter';
import { Metadata } from 'next';

interface PageProps {
    params: { slug?: string[] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const slug = params.slug || [];
    const path = slug.join('/') || 'page.md';
    const mdPath = path.endsWith('.md') ? path : (path === 'page.md' ? 'page.md' : `${path}/page.md`);

    const content = await getRemoteFile(mdPath);
    if (content) {
        const { data } = matter(content);
        return {
            title: data.title || 'Paradigm Threat',
            description: data.description || 'Conspiracy Repository',
        };
    }
    return {
        title: slug.length > 0 ? slug[slug.length - 1] : 'Paradigm Threat',
    };
}

export default async function CatchAllPage({ params }: PageProps) {
    const slug = params.slug || [];
    const path = slug.join('/');

    const filesIndex = await getFilesIndex();

    // Try priority files
    const priorityFiles = ['page.md', 'index.md', 'A.md', 'a.md', 'README.md', 'readme.md'];
    let content = null;
    let targetPath = '';

    if (path && (path.endsWith('.md') || path.endsWith('.mdx'))) {
        content = await getRemoteFile(path);
        targetPath = path;
    } else {
        for (const f of priorityFiles) {
            const p = path ? `${path}/${f}` : f;
            content = await getRemoteFile(p);
            if (content) {
                targetPath = p;
                break;
            }
        }
    }

    if (content) {
        const { content: mdxSource } = matter(content);
        const basePath = targetPath.includes('/') ? targetPath.split('/').slice(0, -1).join('/') : '';
        return (
            <article className="prose prose-slate dark:prose-invert max-w-none">
                <RemoteMDX source={mdxSource} basePath={basePath} />
            </article>
        );
    }

    // Directory listing if no main content file
    const subFiles = filesIndex.filter(f => f.startsWith(path + (path ? '/' : '')));
    const relativeFiles = subFiles.map(f => f.slice(path ? path.length + 1 : 0));

    const directFiles = relativeFiles.filter(f => !f.includes('/')).sort();
    const subDirs = Array.from(new Set(relativeFiles.filter(f => f.includes('/')).map(f => f.split('/')[0]))).sort();

    if (directFiles.length === 0 && subDirs.length === 0) {
        return <div className="text-center py-20 text-slate-500">404 - Not Found — {path}</div>;
    }

    const images = directFiles.filter(f => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f));
    const mds = directFiles.filter(f => f.endsWith('.md') && !priorityFiles.includes(f) && !f.endsWith('.auto.md'));

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-4xl font-extrabold mb-8 capitalize tracking-tight text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">
                    {path.split('/').pop() || 'Home'}
                </h1>

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
                        {await Promise.all(mds.map(async f => {
                            const fullPath = `${path ? path + '/' : ''}${f}`;
                            const fileContent = await getRemoteFile(fullPath);
                            if (!fileContent) return null;
                            const { content: mdxSource, data: frontMatter } = matter(fileContent);
                            return (
                                <section key={f} className="relative">
                                    <div className="flex items-center gap-3 mb-6 group">
                                        <div className="w-1 h-8 bg-blue-500 rounded-full" />
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                                            {frontMatter.title || f.replace(/_/g, ' ').replace('.md', '')}
                                        </h2>
                                        <Link href={`/${fullPath}`} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:text-blue-500">
                                            #link
                                        </Link>
                                    </div>
                                    <article className="prose prose-slate dark:prose-invert max-w-none bg-white dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
                                        <RemoteMDX source={mdxSource} basePath={path} />
                                    </article>
                                </section>
                            );
                        }))}
                    </div>
                )}

                {images.length > 0 && (
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-8 bg-purple-500 rounded-full" />
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gallery</h2>
                        </div>
                        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                            {images.map(img => (
                                <div key={img} className="break-inside-avoid">
                                    <div className="group relative transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                        <PopImage
                                            src={img}
                                            basePath={path}
                                            w={600}
                                            className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02] clear-none m-0 shadow-none ring-0 rounded-none"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <p className="text-[10px] text-white truncate font-mono">{img.split('/').pop()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
