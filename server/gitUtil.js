import { join } from 'path'
import { simpleGit } from 'simple-git'

export function getGitInstance (baseDir = '') {
  if (typeof gitInstance[baseDir] === 'undefined') {
    const options = {
      baseDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false
    }
    gitInstance[baseDir] = simpleGit(options)
  }
  return gitInstance[baseDir]
}

const gitInstance = {}

export async function getGitChangeLog (logCountPerRepo = 6) {
  let changeLog = []
  const paths = ['']
  for (const path of paths) {
    const git = getGitInstance(join(process.cwd(), path))
    const { all } = await git.log({ maxCount: logCountPerRepo })
    const pathChangeLog = all.map(e => ({
      hash: e.hash, date: e.date, message: e.message, authorName: e.author_name
    }))
    changeLog = [...changeLog, ...pathChangeLog]
  }
  return changeLog.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}
