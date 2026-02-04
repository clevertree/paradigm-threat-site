import React, { useMemo, memo, useEffect } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import * as componentsNamespace from '@/components';
import { MarkdownLink } from './MarkdownLink';

const {
    PopImage,
    OptimizedImage,
    ChatRoom,
    ChangeLog,
    DynamicIndex,
    DynamicNav,
    EmbedFile,
    ImageGalleryProvider,
    FloatingDiv,
    ThemeToggle,
    Navbar
} = componentsNamespace;

const mdxComponents = (basePath: string) => ({
    PopImage: (props: any) => <PopImage {...props} basePath={basePath} />,
    OptimizedImage: (props: any) => <OptimizedImage {...props} basePath={basePath} />,
    ChatRoom,
    ChangeLog,
    DynamicIndex: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    DynamicNav: (props: any) => <DynamicNav {...props} currentPath={basePath} />,
    EmbedFile: (props: any) => {
        let src = props.src;
        if (src && src.startsWith('./')) {
            const path = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : '';
            src = path + src.slice(2);
        } else if (src && !src.startsWith('/') && !src.startsWith('http')) {
            const path = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : '';
            src = path + src;
        }
        return <EmbedFile {...props} src={src} currentPath={basePath} />;
    },
    ImageGalleryProvider,
    FloatingDiv,
    ThemeToggle,
    Navbar,
    img: (props: any) => <PopImage {...props} basePath={basePath} />,
    AutoContent: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    Auto: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    a: MarkdownLink,
});

export const RemoteMDX = memo(function RemoteMDX({ source, basePath = '' }: { source: string, basePath?: string }) {
    const components = useMemo(() => mdxComponents(basePath), [basePath]);

    // Notify DynamicIndex (sidebar TOC) to re-scan headers after this content is in the DOM
    useEffect(() => {
        if (!source) return;
        const id = setTimeout(() => {
            window.dispatchEvent(new Event('dynamic-index-update'));
        }, 150);
        return () => clearTimeout(id);
    }, [source]);

    return (
        <div className="mdx-content">
            <MDXRemote
                source={source}
                components={components as any}
                options={{
                    mdxOptions: {
                        remarkPlugins: [remarkGfm],
                    },
                }}
            />
        </div>
    );
});
