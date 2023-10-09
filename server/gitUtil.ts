import {SimpleGit, simpleGit} from 'simple-git';

export function getGitInstance() {
    if (!gitInstance) {
        const options = {
            baseDir: process.cwd() + '/app',
            binary: 'git',
            maxConcurrentProcesses: 6,
            trimmed: false,
        };
        gitInstance = simpleGit(options);
    }
    return gitInstance;
}

let gitInstance: SimpleGit;

export async function getGitChangeLog(maxCount: number = 15) {
    const git = getGitInstance();
    const {all} = await git.log({maxCount: parseInt(`${maxCount}`)});
    const changeLog = all.map(({hash, date, message, author_name}) => ({
        hash, date, message, author_name
    })).sort((a, b) => +new Date(b.date) - +new Date(a.date));
    return changeLog;
}