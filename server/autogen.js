const { readdir, writeFile, readFile } = require('fs/promises')
const { join, resolve } = require('path')
const { existsSync } = require('fs')
const { fileExists } = require('next/dist/lib/file-exists')

const FILE_NAV_IGNORE = `${process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE || '.navignore'}`
const PATH_ASSETS_ABS = join(resolve(__dirname, '../'), `${process.env.NEXT_PUBLIC_ASSET_PATH || 'app'}`)
generate()

async function generate () {
  await generateAllPages()
  await generateDirectory()
}

async function generateDirectory () {
  async function getPathsForDirectory (currentPathRelative) {
    const directories = {}
    const absPath = join(PATH_ASSETS_ABS, currentPathRelative)
    const dirents = await readdir(absPath, { withFileTypes: true })
    // if (dirents.some(dirent => dirent.name === process.env.NEXT_PUBLIC_ASSET_NAV_IGNORE_FILE))
    //     return null;

    for (const dirent of dirents) {
      if (dirent.isDirectory()) {
        const subFolderPathRelative = join(currentPathRelative, dirent.name)
        const ignoreFile = join(absPath, subFolderPathRelative, FILE_NAV_IGNORE)
        if (!existsSync(ignoreFile)) {
          directories[dirent.name] = await getPathsForDirectory(subFolderPathRelative)
        }
      }
    }
    return directories
  }

  const directories = await getPathsForDirectory('/')
  const directoryFile = `${PATH_ASSETS_ABS}/directory.json`
  // console.log("Writing directory file: ", directoryFile)
  await writeOrIgnoreFile(directoryFile, JSON.stringify(directories))
}

async function generateAllPages () {
  for await (const appSubDirectory of listDirectoriesRecursive(PATH_ASSETS_ABS)) {
    await generatePages(appSubDirectory)
  }
}

async function generatePages (directoryPath) {
  const imageStyleRight = 'w-full sm:w-[inherit] float-right clear-right sm:m-1 sm:ml-4'
  const imageStyleLeft = 'w-full sm:w-[inherit] float-left clear-left sm:m-1 sm:mr-4'
  // const imageStyleRight = "w-full sm:max-w-[50vw] md:max-w-md float-right sm:m-1 sm:ml-4";
  // const imageStyleLeft = "w-full sm:max-w-[50vw] md:max-w-md float-left sm:m-1 sm:mr-4";
  const pdfStyleRight = 'w-full md:w-[24rem] md:h-[36rem] float-right sm:m-1 sm:ml-4'
  const pdfStyleLeft = 'w-full md:w-[24rem] md:h-[36rem] float-left sm:m-1 sm:mr-4'
  const mdStyle = 'w-full md:max-w-[80rem] float-right italic'

  const componentList = {}
  const mdxContent = {
    content: [],
    contentLast: [],
    imports: []
  }
  let i = 0
  if (existsSync(join(directoryPath, 'page.mdx')) ||
    existsSync(join(directoryPath, 'route.mdx')) ||
    existsSync(join(directoryPath, FILE_NAV_IGNORE))) {
    // console.log("Skipping directory: ", directoryPath)
    return
  }

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
            console.log(`Found index file. Canceling auto generation for ${directoryPath}: `, pFile.name)
            return
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
        case 'svg':
        case 'ppm':
        case 'avif':
          componentList.PopImage = true
          mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`)
          mdxContent.content.push(`<PopImage className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}" src={${fileNameVariable}} alt="${pFile.name}">`)
          mdxContent.content.push(`\t${pFile.name}`)
          mdxContent.content.push('</PopImage>')
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
          mdxContent.content.push(`\t<Link rel='stylesheet' href={${fileNameVariable}.src}/>`)
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

async function writeOrIgnoreFile (filePath, fileContent) {
  if (await fileExists(filePath)) {
    const existingFileContent = await readFile(filePath, 'utf8')
    if (existingFileContent === fileContent) {
      // console.log("Directory file was not updated:", directoryFile)
      return
    }
  }
  console.log('Generating file: ', filePath)
  await writeFile(filePath, fileContent)
}

async function * listDirectoriesRecursive (dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const currentPath = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      const ignoreFile = join(currentPath, FILE_NAV_IGNORE)
      if (!existsSync(ignoreFile)) {
        yield currentPath
        yield * listDirectoriesRecursive(currentPath)
      } else {
        // console.log("Ignoring path: ", currentPath)
      }
    }
  }
}
