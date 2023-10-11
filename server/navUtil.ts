import {join, resolve} from "path";
import fs from "fs";

const {readdir} = fs.promises;

export async function getNavDirectories() {
    async function getPathsForDirectory(currentPathRelative: string) {
        const directories: any = {};
        const absPath = resolve(process.cwd(), join(`${process.env.NEXT_PUBLIC_ASSET_PATH}`, currentPathRelative))
        const dirents = await readdir(absPath, {withFileTypes: true});
        // if (dirents.some(dirent => dirent.name === process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE))
        //     return null;

        for (const dirent of dirents) {
            if (dirent.isDirectory()) {
                const subFolderPathRelative = join(currentPathRelative, dirent.name);
                const ignoreFile = join(absPath, subFolderPathRelative, `${process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE}`);
                if (!fs.existsSync(ignoreFile)) {
                    directories[dirent.name] = await getPathsForDirectory(subFolderPathRelative)
                }
            }
        }
        return directories;
    }

    const directories = await getPathsForDirectory('/');
    console.log('directories', directories)
    return directories;
}