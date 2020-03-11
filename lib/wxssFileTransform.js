const postcss = require('postcss')
const {
    saveFile,
    getFileContent,
    getFileName
} = require('./utils')
const sass = require('node-sass');
const path = require('path')

function transform(code, mapping, filePath, toAppType) {
    let cssAst = postcss.parse(code)
    let importList = []
    let css
    let tjImgBgIndex
    cssAst.nodes = cssAst.nodes.filter((v, i) => {

        if (toAppType === 'zfb' && /tjGlobal\.acss/.test(filePath) && v.selector === '.tj-img-background') {
            let index = v.nodes.findIndex(v => v.prop === 'background-image')
            if (index != -1) return v.nodes[index].remove()
        }
        if (v.name === 'import') {
            if (toAppType !== 'wx') {
                if (/\.wxss/.test(v.params)) {
                    v.params = v.params.replace(/wxss/, mapping.fileFormatName['wxss'])
                }
                if (/miniprogram_npm/.test(v.params)) {
                    v.params = v.params.replace(/miniprogram_npm/, 'node_modules')
                }
            }

            if (!/\.scss/.test(v.params)) {
                importList.push(v.params)
                return false
            }
            return true
        } else {
            return true
        }
    })
    // if (tjImgBgIndex) cssAst.nodes.splice(tjImgBgIndex, 1)

    css = cssAst.toResult().css

    if (css && mapping.istransfromScss) {
        css = sass.renderSync({
            data: css,
            includePaths: ['zfb_dist'],
            outputStyle: 'expanded',
            // importer(url, prev, done) {
            //     return {
            //         file: url
            //     }

            // }
        }).css.toString()
    }
    importList.forEach(v => css = `@import ${v};\n` + css)
    return css

}

async function wxssFileTransform(mapping, newProjectPath, filePath, toAppType, toFilePath) {

    let fileConent
    fileConent = await getFileContent(filePath, 'utf-8')
    fileConent = await transform(fileConent, mapping, filePath, toAppType)
    saveFile(toFilePath ? toFilePath : filePath, fileConent)

}



module.exports = {
    wxssFileTransform,
    wxssCodeTransform: transform
}