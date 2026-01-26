import type {MDXComponents} from 'mdx/types'
import Link from 'next/link'

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including components from
// other libraries.

// This file is required to use MDX in `app` directory.
export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        // Allows customizing built-in components, e.g. to add styling.
        a: ({children, href, ref, ...props}: any) => {
            const isExternal = href?.startsWith('http');
            if (isExternal) {
                return <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                >{children}</a>
            }
            return <Link
                href={href || ''}
                {...props}
            >{children}</Link>
        },
        ...components,
    }
}