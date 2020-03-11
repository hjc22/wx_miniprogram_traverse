const babylon = require('babylon')
const traverse = require('babel-traverse').default
const generator = require('babel-generator').default
const t = require('babel-types')
const {
    saveFile,
    getFileContent,
} = require('./utils')

function transform(code, mapping, filePath) {
    let ast = babylon.parse(code, {
        sourceType: 'module',
        plugins: '*'
    })

    traverse(ast, {
        ExpressionStatement(path) {
            try {
                let expression = path.node.expression
                if (t.isAssignmentExpression(expression) && expression.left && expression.left.object && expression.left.object.name === 'module' && expression.left.property.name === 'exports') {
                    path.replaceWith(t.exportDefaultDeclaration(t.isIdentifier(expression.right) ? expression.right : t.objectExpression(expression.right.properties)))
                }
            } catch (err) {
                console.log('转换错误：'.red, filePath)
                console.error(err)
            }

        }
    })

    return generator(ast).code
}

async function wxsFileTransform(mapping, newProjectPath, filePath, toAppType, toFilePath) {

    let fileConent
    fileConent = await getFileContent(filePath, 'utf-8')
    toAppType !== 'wx' && (fileConent = transform(fileConent, mapping, filePath))
    saveFile(toFilePath ? toFilePath : filePath, fileConent)


}



module.exports = wxsFileTransform