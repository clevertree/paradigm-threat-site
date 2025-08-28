const { join, relative } = require('path')
const { mkdirSync, existsSync } = require('fs')
const Sharp = require('sharp')
const path = require('path')

module.exports = async function imageLoader (buffer) {
  const appPath = join(process.cwd(), 'app')
  const publicPath = join(process.cwd(), 'public')
  const relativePath = path.sep + relative(appPath, this.resourcePath)
  // const relativePath = '/' + relative(join(process.cwd(), 'app'), this.resourcePath)
  const queryParams = this.resourceQuery ? Object.fromEntries([...new URLSearchParams(this.resourceQuery.split('?')[1])]) : {}
  // console.log('import image', relativePath)
  // const bytes = fs.statSync(this.resourcePath).size;

  const data = {
    src: relativePath
  }
  try {
    const sharpOriginal = Sharp(buffer)

    // Copy to public folder
    const absFilePath = join(publicPath, relativePath)
    const absDirectoryPath = path.dirname(absFilePath)
    if (!existsSync(absDirectoryPath)) {
      mkdirRecursiveSync(absDirectoryPath)
    }
    await sharpOriginal.toFile(absFilePath)
    console.log('Image copied to public folder: ', absFilePath)

    const { width, height, format } = await sharpOriginal.metadata()
    data.format = format
    data.width = width
    data.height = height
    // data.sourceWidth = width
    // data.sourceHeight = height
    const result = await sharpOriginal
      .resize(8)
      .toBuffer()
    // data.placeholder = 'blur'
    data.blurDataURL = `data:image/${format};base64,${result.toString('base64')}`

    const paramWidth = parseInt(queryParams.w || queryParams.width)
    if (paramWidth) {
      const paramHeight = queryParams.h || queryParams.height || Math.round((paramWidth / width) * height)

      const optimizedImageFileName = `${paramWidth}${relativePath.replace(/[/. ]/g, '_')}.webp`
      const optimizedImageRelativeDirectoryPath = process.env.NEXT_PUBLIC_OPTIMIZE_IMAGE_PATH || '/site/thumb'
      const optimizedImageRelativePath = join(optimizedImageRelativeDirectoryPath, optimizedImageFileName)
      const optimizedImageAbsFilePath = join(publicPath, optimizedImageRelativePath)
      const optimizedImageAbsDirectoryPath = path.dirname(optimizedImageAbsFilePath)
      if (!existsSync(optimizedImageAbsFilePath)) {
        mkdirRecursiveSync(optimizedImageAbsDirectoryPath)
        await Sharp(buffer)
          .resize(paramWidth, paramHeight)
          .toFile(optimizedImageAbsFilePath)
        // console.info(info)
        console.log('Optimizing image created: ', optimizedImageAbsFilePath)
      } else {
        console.log('Optimizing image already exists: ', optimizedImageRelativePath)
      }
      data.optimizedSrc = optimizedImageRelativePath
      data.width = paramWidth
      data.height = paramHeight
    }
  } catch (e) {
    // data.width = 300
    // data.height = 300
    console.error('Could not determine image data for ' + relativePath, e)
  }

  // if (process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES) {
  // }
  // try {
  //   Sharp(buffer)
  //     .resize(320, 240)
  //     .toFile('output.webp', (err, info) => { throw err })
  // } catch (e) {
  //
  // }
  // const response = await getImageSize(source, ext);
  return `export default ${JSON.stringify(data)};`
}

function mkdirRecursiveSync (dir) {
  if (existsSync(dir)) { return true }
  const dirname = path.dirname(dir)
  mkdirRecursiveSync(dirname)
  mkdirSync(dir)
}

module.exports.raw = true
