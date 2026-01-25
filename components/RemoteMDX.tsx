import React from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import * as componentsNamespace from '@/components';

// Extract components from the namespace
const { PopImage, OptimizedImage, ChatRoom, ChangeLog, DynamicIndex, DynamicNav, EmbedFile, ImageGalleryProvider } = componentsNamespace;

const mdxComponents = (basePath: string) => ({
    ...componentsNamespace,
    img: (props: any) => <PopImage {...props} basePath={basePath} />,
    PopImage: (props: any) => <PopImage {...props} basePath={basePath} />,
    OptimizedImage: (props: any) => <OptimizedImage {...props} basePath={basePath} />,
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
    DynamicIndex: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    DynamicNav: (props: any) => <DynamicNav {...props} currentPath={basePath} />,
    AutoContent: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
    Auto: (props: any) => <DynamicIndex {...props} mode="inline" currentPath={basePath} />,
});

export function RemoteMDX({ source, basePath = '' }: { source: string, basePath?: string }) {
    return (
        <div className="mdx-content">
            <MDXRemote
                source={source}
                components={mdxComponents(basePath) as any}
                options={{
                    mdxOptions: {
                        remarkPlugins: [remarkGfm],
                    },
                }}
            />
        </div>
    );
}
