import fs from 'fs'
import path from 'path'
import mime from 'mime'

const readline = require('readline')
const { readdir } = require('fs/promises')
const { join, resolve } = require('path')

const FILE_NAV_IGNORE = `${process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE || '.navignore'}`

export function handleFileRequest (req, pathString) {
  if (Array.isArray(pathString)) { pathString = pathString.join('/') }
  const filePath = path.resolve(process.cwd(), `${process.env.NEXT_PUBLIC_ASSET_PATH}`, pathString)
  if (fs.existsSync(filePath)) {
    const imageBuffer = fs.readFileSync(filePath)
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': `${mime.getType(filePath)}`,
        'Cache-Control': 'max-age=31536000'
      }
    })
  }

  console.error('File not found: ', pathString)
  return new Response('File not found', {
    status: 400,
    headers: {
      'Content-Type': `${mime.getType(filePath)}`,
      'Cache-Control': 'max-age=31536000'
    }
  })
}

export async function * listFilesRecursive (absoluteDirectoryPath, ignoreRegexList = [], matchRegexList = []) {
  return yield * recurse('')

  async function * recurse (relativeDirectoryPath) {
    const recurseAbsoluteDirectoryPath = join(absoluteDirectoryPath, relativeDirectoryPath)
    const ignoreFile = join(recurseAbsoluteDirectoryPath, FILE_NAV_IGNORE)
    if (fs.existsSync(ignoreFile)) { return }

    const dirents = await readdir(recurseAbsoluteDirectoryPath, { withFileTypes: true })
    for (const dirent of dirents) {
      if (dirent.isFile() && !matchRegexList.some(regex => regex.test(dirent.name))) { continue }
      if (ignoreRegexList.some(regex => regex.test(dirent.name))) { continue }
      const iRelativeDirectory = join(relativeDirectoryPath, dirent.name)
      if (dirent.isDirectory()) {
        yield * recurse(iRelativeDirectory)
      } else {
        const relativeFilePath = join(relativeDirectoryPath, dirent.name)
        const absoluteFilePath = join(absoluteDirectoryPath, relativeFilePath)
        yield {
          relativeDirectoryPath,
          absoluteDirectoryPath: recurseAbsoluteDirectoryPath,
          relativeFilePath,
          absoluteFilePath,
          dirent
        }
      }
    }
  }
}

export async function searchFileContentRecursive (keywords) {
  if (!Array.isArray(keywords)) { keywords = `${keywords}`.split(/[;, ]+/g).filter(i => i) }
  const keywordRegexList = keywords.map(k => new RegExp(k, 'i'))

  const ignoreList = [/^page.auto.mdx$/]
  // const ignoreList = `${process.env.NEXT_PUBLIC_ASSET_IGNORE}`.split(/[;,]+/g).filter(i => i).map(i => new RegExp(i));
  const matchList = [/^.+\.(mdx?|txt)$/g]

  const results = []
  const absAssetPath = resolve(process.cwd(), `${process.env.NEXT_PUBLIC_ASSET_PATH}`)
  // console.log('absAssetPath', absAssetPath)
  for await (const {
    absoluteFilePath,
    relativeDirectoryPath
  } of listFilesRecursive(absAssetPath, ignoreList, matchList)) {
    // const relativeFilePath = absFilePath.substring(absAssetPath.length)
    // const relativeDirectory = relativePath.substring(0, relativeFilePath.length - dirent.name.length)
    // console.log('Reading', relativeFilePath)

    const fileStream = fs.createReadStream(absoluteFilePath)

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const string of rl) {
      if (keywordRegexList.every(regex => regex.test(string))) {
        // if (results.indexOf(noExtPath) === -1)
        //     results.push(noExtPath);
        // console.log(`Found ${line}: ${string}`);
        let result = results.find(r => r.path === relativeDirectoryPath)
        if (!result) {
          result = { path: relativeDirectoryPath, lines: [] }
          results.push(result)
        }
        result.lines.push(string)
        break
      }
    }
  }
  return results
}

export async function searchFileNamesRecursive (keywords) {
  if (!Array.isArray(keywords)) { keywords = `${keywords}`.split(/[;, ]+/g).filter(i => i) }
  const keywordRegexList = keywords.map(k => new RegExp(k, 'i'))

  const matchList = [/\.(gif|jpg|jpeg|tiff|png|ico|xcf|svg|mp4|m4v|mkv|pdf|txt)$/i]

  const results = []
  const absAssetPath = resolve(process.cwd(), `${process.env.NEXT_PUBLIC_ASSET_PATH}`)
  for await (const { relativeFilePath } of listFilesRecursive(absAssetPath, [], matchList)) {
    if (keywordRegexList.every(regex => regex.test(relativeFilePath))) {
      results.push(relativeFilePath)
    }
  }
  return results
}
