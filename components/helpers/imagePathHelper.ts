export function resolveImagePath(src: string, basePath: string): string {
    if (!src) return '';
    if (src.startsWith('http') || src.startsWith('/')) {
        return src;
    }

    // Strip ./ prefix
    const cleanSrc = src.startsWith('./') ? src.slice(2) : src;

    // Normalize path logic: combine basePath and cleanSrc
    let finalPath = '';
    if (basePath) {
        const base = basePath.endsWith('/') ? basePath : basePath + '/';
        finalPath = base + cleanSrc;
    } else {
        finalPath = cleanSrc;
    }

    return finalPath;
}

export function extractWidthFromSrc(src: string): { cleanSrc: string, width?: number } {
    if (!src) return { cleanSrc: '' };

    try {
        const url = new URL(src, 'https://dummy.com'); // dummy base to handle relative URLs as if they were full
        const w = url.searchParams.get('w');
        if (w) {
            // Remove the ?w=... part from the src for internal use
            const clean = src.split('?')[0];
            return { cleanSrc: clean, width: parseInt(w, 10) };
        }
    } catch (e) {
        // Fallback for tricky strings
    }

    return { cleanSrc: src };
}

const FILES_BASE_URL = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';

export function getAbsoluteImageUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('/')) return path;
    return `${FILES_BASE_URL}/${path}`;
}

export async function fileExists(path: string): Promise<boolean> {
    try {
        const response = await fetch('/files.json');
        if (!response.ok) return false;
        const filesMap = await response.json();

        // Split path into dir and file
        const parts = path.split('/');
        const fileName = parts.pop();
        const dir = '/' + parts.join('/');

        if (filesMap[dir] && fileName) {
            return filesMap[dir].includes(fileName);
        }

        // Root dir fallback
        if (dir === '/' && filesMap['/'] && fileName) {
            return filesMap['/'].includes(fileName);
        }

    } catch (e) {
        console.error('Error checking file index:', e);
    }
    return false;
}
