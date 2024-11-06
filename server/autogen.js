const { readdir, writeFile, readFile } = require('fs/promises')
const {
  join,
  resolve,
  dirname
} = require('path')
require('dotenv').config({ path: resolve(__dirname, '../.env.development.local') })
const CRC32 = require('crc-32')
const { existsSync, createReadStream } = require('fs')
const { getGitChangeLog } = require('./gitUtil')
const { createInterface } = require('node:readline/promises')
const AUTOGEN_DEFAULT_WIDTH = process.env.NEXT_PUBLIC_AUTOGEN_IMAGE_WIDTH || 384
const FILE_NAV_IGNORE = `${process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE || '.navignore'}`
const PATH_ASSETS_ABS = join(resolve(__dirname, '../'), `${process.env.NEXT_PUBLIC_ASSET_PATH || 'app'}`)
const TEXT_FILE_PATTERN = /\.(txt|mdx?)$/i
const TEXT_LINE_IGNORE_PATTERN = /(^import .*$|<([^>]+)>)/igm
const TEXT_KEYWORD_PATTERN = /[a-zA-Z]{3,}/g
const TEXT_KEYWORD_IGNORE_PATTERN = /^(https?|com|net|org|const|metadata|export|description|keywords|title|jpg|png|gif|mdx?)$/i
// const TEXT_FILE_IGNORE_PATTERN = /.auto.mdx$/
const { sql } = require('@vercel/postgres')
generate()

async function generate () {
  await generateAllPages()
  await generateDirectory()
  await generateGitLog()
}

async function generateDirectory () {
  // const files = {}

  async function getPathsForDirectory (currentPathRelative) {
    const directories = {}
    const absPath = join(PATH_ASSETS_ABS, currentPathRelative)
    const dirents = await readdir(absPath, { withFileTypes: true })
    // if (dirents.some(dirent => dirent.name === process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE))
    //     return null;

    let keywordCount = []
    for (const dirent of dirents) {
      const subPathRelative = join(currentPathRelative, dirent.name)
      if (dirent.isDirectory()) {
        const ignoreFile = join(absPath, subPathRelative, FILE_NAV_IGNORE)
        if (!existsSync(ignoreFile)) {
          directories[dirent.name] = await getPathsForDirectory(subPathRelative)
        }
      } else {
        // if (!files[currentPathRelative]) { files[currentPathRelative] = [] }
        // files[currentPathRelative].push(dirent.name)
        // console.log('indexing file: ', subPathRelative)
        if (TEXT_FILE_PATTERN.test(subPathRelative)) {
          const fileKeywordObj = await readTextFileKeywords(subPathRelative)
          for (const keyword of Object.keys(fileKeywordObj))
            keywordCount[keyword] = (keywordCount.hasOwnProperty(keyword) ? keywordCount[keyword] : 0)
              + fileKeywordObj[keyword]
        }
      }
    }
    const keywordList = Object.keys(keywordCount)
    const pairListString = keywordList.sort().map(keyword => `${keyword}:${keywordCount[keyword]}`).join(',')
    // var uniqueAndSortedKeywordString = keywordList.sort().join(',')

    if(await isConnected()) {
      const crc32 = CRC32.str(pairListString) // keywordList.reduce((crc32, keyword) => CRC32.str(keyword), 0)
      if (crc32 !== 0 && !await pathHasCRC(currentPathRelative, crc32)) {
        console.log('indexing path: ', currentPathRelative)
        await sql`SELECT search_add_keywords_to_path(${currentPathRelative}, ${crc32}, ${pairListString});`
      }
    }

    return directories
  }

  const directories = await getPathsForDirectory('/')
  const directoryFile = `${PATH_ASSETS_ABS}/directory.json`
  // console.log("Writing directory file: ", directoryFile)
  await writeOrIgnoreFile(directoryFile, JSON.stringify(directories))
  // const filesFile = `${PATH_ASSETS_ABS}/files.json`
  // await writeOrIgnoreFile(filesFile, JSON.stringify(files))
}

async function generateAllPages () {
  for await (const appSubDirectory of listDirectoriesRecursive(PATH_ASSETS_ABS, FILE_NAV_IGNORE)) {
    await generatePages(appSubDirectory)
  }
}

async function readTextFileKeywords (relativeFilePath) {
  const absFilePath = PATH_ASSETS_ABS + relativeFilePath
  // const directoryPath = dirname(relativeFilePath)
  const fileContent = await readFile(absFilePath, 'utf8')
  const strippedFileContent = fileContent.replace(TEXT_LINE_IGNORE_PATTERN, '')

  let match, keywordObj = {}
  while (match = TEXT_KEYWORD_PATTERN.exec(strippedFileContent)) {
    const keyword = match[0].toLowerCase()
    if (!TEXT_KEYWORD_IGNORE_PATTERN.test(keyword)) {
      keywordObj[keyword] = keywordObj[keyword] ? (keywordObj[keyword] + 1) : 1
    }
  }
  return keywordObj
}

let cachedPathCRCs = null
let connectionFailed = false

async function isConnected () {
  if(connectionFailed)
    return false;
  try {
    await getPathCRCs();
  } catch (e) {
    connectionFailed = true;
    console.log("Error connecting to database", e);
  }
}

async function getPathCRCs () {
  if (!cachedPathCRCs) {
    const { rows } = await sql`SELECT path, crc32
                               FROM search_paths;`
    cachedPathCRCs = {}
    for (const row of rows)
      cachedPathCRCs[row.path] = row.crc32
    console.log(`Found ${rows.length} path entries in database`)
  }
  return cachedPathCRCs
}

async function pathHasCRC (path, crc32) {
  const paths = await getPathCRCs()
  return (paths[path] === crc32)
}

async function generatePages (directoryPath) {
  const imageStyleRight = 'sm:float-right m-auto sm:m-1 sm:ml-4'
  const imageStyleLeft = 'sm:float-left m-auto sm:m-1 sm:mr-4'
  // const imageStyleRight = "w-full sm:max-w-[50vw] md:max-w-md float-right sm:m-1 sm:ml-4";
  // const imageStyleLeft = "w-full sm:max-w-[50vw] md:max-w-md float-left sm:m-1 sm:mr-4";
  const pdfStyleRight = 'w-full md:w-[24rem] md:h-[36rem] float-right sm:m-1 sm:ml-4'
  const pdfStyleLeft = 'w-full md:w-[24rem] md:h-[36rem] float-left sm:m-1 sm:mr-4'
  const mdStyle = 'w-full md:max-w-[80rem] float-right'

  const componentList = {}
  const mdxContent = {
    content: [],
    contentLast: [],
    imports: []
  }
  let i = 0

  const pDir = await readdir(directoryPath, { withFileTypes: true })
  for (const pFile of pDir) {
    if (pFile.isFile()) {
      const ext = pFile.name.toLowerCase().split('.').pop()
      const fileNameVariable = ext.toUpperCase() + '_' + pFile.name.replace(/[^A-Za-z0-9]/g, '_')
      switch (ext) {
        case 'js':
        case 'ts':
          // console.log("Skipping file: ", pFile.name)
          break
        case 'md':
        case 'mdx':
          if (/page\.auto\.mdx$/i.test(pFile.name)) {
            // console.log("Skipping file: ", pFile.name)
            break
          }
          if (/(page|route)\.(mdx?|ts|js)$/i.test(pFile.name)) {
            break
          }
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<div className="${mdStyle}">`)
          mdxContent.content.push(`\t<${fileNameVariable} />`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</div>')
          break
        case 'img':
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'ppm':
        case 'avif':
          componentList.PopImage = true
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}?w=${AUTOGEN_DEFAULT_WIDTH}"`)
          mdxContent.content.push(`<PopImage className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}" src={${fileNameVariable}} alt="${pFile.name}">`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</PopImage>')
          break
        case 'svg':
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
          mdxContent.content.push(`<img src={${fileNameVariable}.src} width={${AUTOGEN_DEFAULT_WIDTH}} alt="${pFile.name}"/>`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</div>')
          break
        case 'm4v':
        case 'mp4':
        case 'mkv':
        case 'webm':
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
          mdxContent.content.push('\t<video controls autoPlay muted loop>')
          mdxContent.content.push(`\t\t<source {...${fileNameVariable}}/>`)
          mdxContent.content.push('\t</video>')
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</div>')
          break
        // mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
        // mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
        // mdxContent.content.push(`\t<img src={${fileNameVariable}.src} />`)
        // mdxContent.content.push(`\t${pFile.name}`)
        // mdxContent.content.push('</div>')
        // break
        case 'json':
        case 'txt':
        case 'csv':
        case 'pdf':
          componentList.EmbedFile = true
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<EmbedFile src={${fileNameVariable}} className="${i++ % 2 === 0 ? pdfStyleRight : pdfStyleLeft}">`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</EmbedFile>')
          break
        case 'css':
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
          mdxContent.content.push(`\t<link rel='stylesheet' href={${fileNameVariable}.src}/>`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</div>')
          break
        case 'html':
        default:
          console.log(`TODO:unhandled asset: ${pFile.name}`)
          break
      }
    }
  }

  if (existsSync(join(directoryPath, 'page.mdx')) ||
    existsSync(join(directoryPath, 'route.mdx'))) {
    // existsSync(join(directoryPath, FILE_NAV_IGNORE))) {
    console.log(`Found index file. Canceling auto generation for ${directoryPath}.`)
    return
  }
  const componentListKeys = Object.keys(componentList)
  if (componentListKeys.length > 0) {
    mdxContent.imports.push(`import {${componentListKeys.join(',')}} from "@components"`)
  }
  const mdxScriptContent = `${mdxContent.imports.join(';\n')}
    
${mdxContent.content.join('\n')}
${mdxContent.contentLast.join('\n')}`

  const autoGenPageFile = `${directoryPath}/page.auto.mdx`
  if (mdxContent.content.length === 0) {
    // console.log("Skipping empty autogenerated page: ", autoGenPageFile)
    return
  }
  // console.log("Writing autogenerated page: ", autoGenPageFile)
  await writeOrIgnoreFile(autoGenPageFile, mdxScriptContent)
}

async function generateGitLog () {
  const projectRoot = resolve(__dirname, '../')
  const changeLog = await getGitChangeLog()

  const gitLogContent = JSON.stringify(changeLog)
  const appDir = join(projectRoot, process.env.NEXT_PUBLIC_ASSET_PATH || 'app')
  const gitLogFile = `${appDir}/git-log.json`

  console.log('Writing git log file: ', gitLogFile)
  await writeFile(gitLogFile, gitLogContent)
}

async function writeOrIgnoreFile (filePath, fileContent) {
  if (existsSync(filePath)) {
    const existingFileContent = await readFile(filePath, 'utf8')
    if (existingFileContent === fileContent) {
      // console.log("Directory file was not updated:", filePath)
      return
    }
  }
  console.log('Generating file: ', filePath)
  await writeFile(filePath, fileContent)
}

async function * listDirectoriesRecursive (dir, ignoreFile = FILE_NAV_IGNORE) {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const currentPath = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      // const ignoreFile = join(currentPath, FILE_NAV_IGNORE)
      if (!ignoreFile || !existsSync(join(currentPath, ignoreFile))) {
        yield currentPath
        yield * listDirectoriesRecursive(currentPath)
      } else {
        console.log('Ignoring recursive path: ', currentPath)
      }
    }
  }
}
