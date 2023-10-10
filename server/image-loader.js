const {join, relative} = require("path");
const fs = require("fs");
const Sharp = require('sharp')

module.exports = async function (buffer) {
    const relativePath = '/' + relative(join(process.cwd(), 'app'), this.resourcePath);
    // console.log('import image', relativePath)
    // const bytes = fs.statSync(this.resourcePath).size;

    let sharpOriginal = Sharp(buffer);

    const {width, height, format} = await sharpOriginal.metadata()
    const result = await sharpOriginal
        .resize(8)
        .toBuffer();
    const blurDataURL = `data:image/${format};base64,${result.toString('base64')}`;

    const data = {
        src: relativePath,
        width,
        height,
        // bytes,
        placeholder: 'blur',
        blurDataURL,
    }
    // const response = await getImageSize(source, ext);
    return `export default ${JSON.stringify(data)};`;

}

module.exports.raw = true;