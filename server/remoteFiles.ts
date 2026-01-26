const FILES_BASE_URL = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://files.paradigmthreat.net';

export async function getFilesIndex() {
    const res = await fetch(`${FILES_BASE_URL}/index.json`, { cache: 'no-store' });
    if (!res.ok) return {};
    return res.json() as Promise<any>;
}

export async function getRemoteFile(path: string) {
    const res = await fetch(`${FILES_BASE_URL}/${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.text();
}

export function getDirStructure(files: any) {
    if (Array.isArray(files)) {
        const structure: any = {};
        files.forEach(file => {
            if (file.includes('node_modules') || file.startsWith('.')) return;
            const parts = file.split('/');
            if (parts.length <= 1) return; // Skip files in root for nav usually, or handle them

            let current = structure;
            // Walk down to the parent directory of the file
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        });
        return structure;
    }
    return files; // Already in tree format
}
