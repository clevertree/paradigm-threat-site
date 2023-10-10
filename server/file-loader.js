const {join, relative} = require("path");
const nextImageLoader = require("next/dist/build/webpack/loaders/next-image-loader");
module.exports = function (source) {

    const relativePath = '/' + relative(join(process.cwd(), 'app'), this.resourcePath);
    // Apply some transformations to the source...
    // console.log('import file', relativePath)
    const data = {
        src: relativePath,
    }
    return `export default ${JSON.stringify(data)};`;

}

module.exports.raw = true;
