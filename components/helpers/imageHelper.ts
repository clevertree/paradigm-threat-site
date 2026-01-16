interface ImagePropsFormatted {
    src: string,
    [key: string]: any
}

const FILES_BASE_URL = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';

let cachedIndex: any = null;
let indexPromise: Promise<any> | null = null;

export async function checkFileExists(path: string): Promise<boolean> {
    try {
        if (!indexPromise) {
            indexPromise = fetch(`${FILES_BASE_URL}/index.json`)
                .then(res => res.ok ? res.json() : null)
                .then(index => {
                    cachedIndex = index;
                    return index;
                });
        }
        const index = await indexPromise;
        if (!index) return false;

        if (Array.isArray(index)) {
            return index.includes(path) || index.includes('/' + path);
        }
        return !!index[path] || !!index['/' + path];
    } catch (e) {
        return false;
    }
}

export function resolveImagePath(src: string, basePath?: string): string {
    if (!src) return '';
    if (src.startsWith('http')) return src;

    // Separate path from query string
    const [pathPart, queryPart] = src.split('?');
    const query = queryPart ? '?' + queryPart : '';

    if (pathPart.startsWith('/')) {
        return pathPart + query; // Already absolute
    }

    let resolved = pathPart;
    if (pathPart.startsWith('./')) {
        resolved = pathPart.slice(2);
    }

    const prefix = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : '';
    // Combine and ensure it starts with / and has no double slashes
    const combined = (prefix + resolved).replace(/\/+/g, '/').replace(/^\/+/, '');
    return '/' + combined + query;
}

export function processImageProps(props: any, basePath?: string): ImagePropsFormatted {
    if (typeof props.src === 'object') {
        const { src, ...otherProps } = props
        const newProps = { ...src, ...otherProps }
        return processImageProps(newProps, basePath)
    }
    if (typeof props.default === 'object') {
        const { default: src, ...otherProps } = props
        const newProps = { ...src, ...otherProps }
        return processImageProps(newProps, basePath)
    }

    let { src, w, title, alt, className, ...finalProps } = props;

    // Parse JSON from title or alt
    const parseMeta = (str: string) => {
        if (typeof str !== 'string') return null;
        const trimmed = str.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                return null;
            }
        }
        return null;
    };

    const meta = parseMeta(title) || parseMeta(alt);
    if (meta) {
        if (meta.className) className = className ? `${className} ${meta.className}` : meta.className;
        if (meta.w) w = meta.w;
        if (meta.weight) w = meta.weight; // Handle common typo
        if (meta.alt) alt = meta.alt;
        if (meta.title) title = meta.title;

        // If the string we parsed was title or alt, clear it if it wasn't replaced by the JSON content
        if (parseMeta(title)) title = meta.title || undefined;
        if (parseMeta(alt)) alt = meta.alt || undefined;

        // Merge any other props
        Object.assign(finalProps, meta);
        delete (finalProps as any).className;
        delete (finalProps as any).w;
    }

    // If optimizedSrc is already provided, we assume the props are already processed
    if (props.optimizedSrc && typeof src === 'string') {
        return { ...props, title, alt, className } as ImagePropsFormatted;
    }

    if (typeof src === "string") {
        // Resolve to absolute path relative to file server root
        const resolved = resolveImagePath(src, basePath);

        // Strip query string for the API path parameter
        const [cleanPath, queryStr] = resolved.split('?');
        const queryParams = new URLSearchParams(queryStr || '');

        // Use width from query string if not provided in props
        if (!w && queryParams.has('w')) {
            w = queryParams.get('w');
        }

        // pathForAPI should be an absolute path starting with /
        // but without domain even if resolved somehow included it
        let pathForAPI = cleanPath;
        if (cleanPath.startsWith(FILES_BASE_URL)) {
            pathForAPI = cleanPath.slice(FILES_BASE_URL.length);
        }

        // Ensure pathForAPI starts with / if not http
        if (!pathForAPI.startsWith('http') && !pathForAPI.startsWith('/')) {
            pathForAPI = '/' + pathForAPI;
        }

        if (w) {
            finalProps.optimizedSrc = `/api/image?path=${encodeURIComponent(pathForAPI)}&w=${w}`;
            finalProps.width = typeof w === 'string' ? parseInt(w) : w;
        } else {
            // Default optimization width
            finalProps.optimizedSrc = `/api/image?path=${encodeURIComponent(pathForAPI)}&w=800`;
            finalProps.width = 800;
        }

        // High res for popout (full URL)
        finalProps.highResSrc = pathForAPI.startsWith('http') ? pathForAPI : `${FILES_BASE_URL}${pathForAPI}`;

        return { src: pathForAPI, ...finalProps, title, alt, className } as ImagePropsFormatted;
    }

    throw new Error('Invalid src string' + JSON.stringify(props));
}
