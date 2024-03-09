const { join, relative } = require('path')
const { mkdirSync, existsSync } = require('fs')
const Sharp = require('sharp')

module.exports = async function imageLoader (buffer) {
  const appPath = join(process.cwd(), 'app')
  const relativePath = '/' + relative(appPath, this.resourcePath)
  // const relativePath = '/' + relative(join(process.cwd(), 'app'), this.resourcePath)
  const queryParams = this.resourceQuery ? Object.fromEntries([...new URLSearchParams(this.resourceQuery.split('?')[1])]) : {}
  // console.log('import image', relativePath)
  // const bytes = fs.statSync(this.resourcePath).size;

  const data = {
    src: relativePath
  }
  try {
    const sharpOriginal = Sharp(buffer)

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
      const optimizedImageRelativeDirectoryPath = '/_opt/img'
      const optimizedImageRelativePath = join(optimizedImageRelativeDirectoryPath, optimizedImageFileName)
      const optimizedImageAbsPath = join(appPath, optimizedImageRelativePath)
      if (!existsSync(optimizedImageAbsPath)) {
        mkdirSync(join(appPath, optimizedImageRelativeDirectoryPath), { recursive: true })
        await Sharp(buffer)
          .resize(paramWidth, paramHeight)
          .toFile(optimizedImageAbsPath)
        // console.info(info)
        console.log('Optimizing image created: ', optimizedImageRelativePath)
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

module.exports.raw = true
