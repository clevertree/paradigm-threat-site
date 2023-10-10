const {listDirectoriesRecursive} = require('./util')

const {readdir, writeFile} = require("fs/promises");
const React = require("react");
const {join, resolve} = require("path");
const {existsSync} = require("fs");

async function generate() {
    const projectRoot = resolve(__dirname, '../');
    const appDir = join(projectRoot, process.env.NEXT_PUBLIC_ASSET_PATH || 'app');
    for await (const appSubDirectory of listDirectoriesRecursive(appDir)) {
        await generateDirectory(appSubDirectory)

    }

}

async function generateDirectory(directoryPath) {

    const imageStyleRight = "w-full sm:max-w-[50vw] md:max-w-[33vw] xl:max-w-md float-right clear-right sm:m-";
    const imageStyleLeft = "w-full sm:max-w-[50vw] md:max-w-[33vw] xl:max-w-md float-left clear-left sm:m-1";
    // const imageStyleRight = "w-full sm:max-w-[50vw] md:max-w-md float-right sm:m-1 sm:ml-4";
    // const imageStyleLeft = "w-full sm:max-w-[50vw] md:max-w-md float-left sm:m-1 sm:mr-4";
    const pdfStyleRight = "w-full md:w-[24rem] md:h-[36rem] float-right sm:m-1 sm:ml-4";
    const pdfStyleLeft = "w-full md:w-[24rem] md:h-[36rem] float-left sm:m-1 sm:mr-4";
    const mdStyle = "w-full md:max-w-[80rem] float-right italic";

    let componentList = {}
    let mdxContent = {
        content: [],
        contentLast: [],
        imports: []
    };
    let i = 0;
    if (existsSync(join(directoryPath, 'page.mdx')) || existsSync(join(directoryPath, 'route.mdx'))) {
        console.log("Skipping directory: ", directoryPath)
        return
    }

    const pDir = await readdir(directoryPath, {withFileTypes: true});
    for (const pFile of pDir) {
        if (pFile.isFile()) {
            const ext = pFile.name.toLowerCase().split('.').pop();
            let fileNameVariable = ext.toUpperCase() + '_' + pFile.name.replace(/[^A-Za-z0-9]/g, '_')
            switch (ext) {
                case 'js':
                case 'ts':
                    console.log("Skipping file: ", pFile.name)
                    continue;
                case 'md':
                case 'mdx':
                    if (/page\.auto\.mdx$/i.test(pFile.name)) {
                        console.log("Skipping file: ", pFile.name)
                        continue;
                    }
                    if (/(page|route)\.(mdx?|ts|js)$/i.test(pFile.name)) {
                        console.log(`Found index file. Canceling auto generation for ${directoryPath}: `, pFile.name)
                        return;
                    }
                    mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`);
                    mdxContent.content.push(`<div className="${mdStyle}">`)
                    mdxContent.content.push(`\t<${fileNameVariable} />`);
                    mdxContent.content.push(`\t${pFile.name}`);
                    mdxContent.content.push(`</div>`)
                    break;
                case 'img':
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'svg':
                case 'ppm':
                    componentList['PopImage'] = true;
                    mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`);
                    mdxContent.content.push(`<PopImage className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}" src={${fileNameVariable}} alt="${pFile.name}">`);
                    mdxContent.content.push(`\t${pFile.name}`);
                    mdxContent.content.push(`</PopImage>`)
                    break;
                case 'm4v':
                case 'mp4':
                case 'mkv':
                    mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`);
                    mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
                    mdxContent.content.push(`
    <video controls>
        <source src={${fileNameVariable}} type="video/mp4"/>
    </video>`)
                    mdxContent.content.push(`\t${pFile.name}`);
                    mdxContent.content.push(`</div>`)
                    break;
                case 'pdf':
                    componentList['ClientPDF'] = true;
                    mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`);
                    mdxContent.content.push(`<ClientPDF src={${fileNameVariable}} className="${i++ % 2 === 0 ? pdfStyleRight : pdfStyleLeft}">`)
                    mdxContent.content.push(`\t${pFile.name}`);
                    mdxContent.content.push(`</ClientPDF>`)
                    break;
                case 'css':
                    mdxContent.imports.push(`import ${fileNameVariable} from "./${pFile.name}"`);
                    mdxContent.content.push(`<div className="${i++ % 2 === 0 ? imageStyleRight : imageStyleLeft}">`)
                    mdxContent.content.push(`\t<Link rel='stylesheet' href={${fileNameVariable}.src}/>`);
                    mdxContent.content.push(`\t${pFile.name}`);
                    mdxContent.content.push(`</div>`)
                    break;
                case 'json':
                case 'txt':
                default:
                    console.log(`TODO:unhandled asset: ${pFile.name}`);
                    break;
            }

        }
    }
    const componentListKeys = Object.keys(componentList);
    if (componentListKeys.length > 0) {
        mdxContent.imports.push(`import {${componentListKeys.join(',')}} from "@components"`);
    }
    const mdxScriptContent = `${mdxContent.imports.join(';\n')}
    
${mdxContent.content.join('\n')}
${mdxContent.contentLast.join('\n')}`;

    const autoGenPageFile = `${directoryPath}/page.auto.mdx`
    if (mdxContent.content.length === 0) {
        console.log("Skipping empty autogenerated page: ", autoGenPageFile)
        return;
    }
    console.log("Writing autogenerated page: ", autoGenPageFile)
    await writeFile(autoGenPageFile, mdxScriptContent);
}

generate()