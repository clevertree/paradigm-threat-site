export function flattenFilesIndex(index: any, prefix = ''): string[] {
    if (!index || typeof index !== 'object') return [];
    if (Array.isArray(index)) return index;

    let paths: string[] = [];
    for (const key in index) {
        if (key.startsWith('_')) continue;

        const path = prefix ? `${prefix}/${key}` : key;
        const value = index[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const children = Object.keys(value).filter(k => !k.startsWith('_'));
            if (children.length === 0) {
                // It's a file
                paths.push(path);
            } else {
                // It's a directory
                // We add the directory itself to paths so it can be searched too? 
                // The original logic expected a list of all files. 
                // If we want to find folders, we should probably add them.
                paths.push(path);
                paths.push(...flattenFilesIndex(value, path));
            }
        } else {
            paths.push(path);
        }
    }
    return paths;
}
