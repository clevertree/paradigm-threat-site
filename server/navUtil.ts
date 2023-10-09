import path from "path";
import fs from "fs";

const {readdir} = fs.promises;

export async function getNavDirectories(pathString: string) {
    const ignoreRegexList: RegExp[] = `${process.env.NEXT_PUBLIC_ASSET_IGNORE}`.split(/[;,]+/g).filter(i => i).map(i => new RegExp(i));
    const directories: string[][] = [];
    const uniqueList: string[] = []

    async function getPathsForDirectory(currentPath: string) {
        const directories = [];
        const absAssetPath = path.resolve(process.cwd(), path.join(`${process.env.NEXT_PUBLIC_ASSET_PATH}`, currentPath))
        if (fs.existsSync(absAssetPath)) {
            const dirents = await readdir(absAssetPath, {withFileTypes: true});
            for (const dirent of dirents) {
                let ignored = false;
                for (const ignoreRegex of ignoreRegexList) {
                    if (!ignored && ignoreRegex.test(dirent.name)) {
                        ignored = true;
                        break;
                    }
                }
                if (ignored)
                    continue;
                if (uniqueList.indexOf(dirent.name) !== -1)
                    continue;
                uniqueList.push(dirent.name)

                if (dirent.isDirectory()) {
                    directories.push(path.join(currentPath, dirent.name));
                } else if (dirent.isFile()) {
                    const fileNameLC = `${dirent.name.split('/').pop()}`.toLowerCase();
                    const ext = `${fileNameLC.split('.').pop()}`;
                    if (/\.mdx?$/.test(ext) && !/index\.mdx?$/i.test(fileNameLC)) {
                        const absFilePath = path.join(absAssetPath, dirent.name);
                        const noExtPath = dirent.name
                            .replace(/\.mdx?$/, '')
                        directories.push(path.join(currentPath, noExtPath));
                    }
                }
            }
        }
        return directories;
    }

    // directories[0] = await getPathsForDirectory('/');

    let currentPath = '/';
    directories[0] = await getPathsForDirectory(currentPath);

    const pathParts = pathString.split('/').filter(p => p);
    for (let pathLevel = 0; pathLevel < pathParts.length; pathLevel++) {
        const pathPart = pathParts[pathLevel];
        currentPath += currentPath + pathPart + '/';
        directories[pathLevel + 1] = await getPathsForDirectory(currentPath);
    }

    return directories;
}