const { join, relative } = require('path')
const Sharp = require('sharp')

module.exports = async function (buffer) {
  const relativePath = '/' + relative(join(process.cwd(), 'app'), this.resourcePath)
  // console.log('import image', relativePath)
  // const bytes = fs.statSync(this.resourcePath).size;

  const data = {
    src: relativePath
  }
  try {
    const sharpOriginal = Sharp(buffer)

    const { width, height, format } = await sharpOriginal.metadata()
    data.format = format
    data.height = height
    data.width = width
    data.sourceWidth = width
    data.sourceHeight = height
    const result = await sharpOriginal
      .resize(8)
      .toBuffer()
    data.placeholder = 'blur'
    data.blurDataURL = `data:image/${format};base64,${result.toString('base64')}`
  } catch (e) {
    // data.width = 300
    // data.height = 300
    console.error('Could not determine image data for ' + relativePath, e)
  }
  // const response = await getImageSize(source, ext);
  return `export default ${JSON.stringify(data)};`
}

module.exports.raw = true
