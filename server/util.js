const { readdir } = require('fs/promises')
const { join } = require('path')

module.exports = {
  listFilesRecursive: async function * listFilesRecursive (dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
      const currentPath = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        yield * listFilesRecursive(currentPath)
      } else {
        yield currentPath
      }
    }
  },
  listDirectoriesRecursive: async function * listDirectoriesRecursive (dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
      const currentPath = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        yield currentPath
        yield * listDirectoriesRecursive(currentPath)
      }
    }
  }
}
