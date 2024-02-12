const { simpleGit } = require('simple-git')
module.exports = {
  getGitChangeLog
  // getGitInstance
}

function getGitInstance () {
  if (!gitInstance) {
    const options = {
      baseDir: process.cwd() + '/app',
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false
    }
    gitInstance = simpleGit(options)
  }
  return gitInstance
}

let gitInstance

async function getGitChangeLog (maxCount = 8) {
  const git = getGitInstance()
  const { all } = await git.log({ maxCount: parseInt(`${maxCount}`) })
  return all.map(({ hash, date, message }) => ({
    hash, date, message
  })).sort((a, b) => +new Date(b.date) - +new Date(a.date))
}
