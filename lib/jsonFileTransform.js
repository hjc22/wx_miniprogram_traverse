const prettier = require('prettier')
const {
    saveFile,
    getFileContent,
    getFileName
} = require('./utils')
const path = require('path')
let projectPackageJson

function transform(code, mapping, filePath) {
    // console.log(code)
    let fileName = getFileName(filePath)
    let delTabBarIndex = -1
    if (fileName === 'app.json') {
        if (code.subPackages && code.subPackages.length) {
            code.pages = code.pages.concat(...code.subPackages.map(v => v.pages.map(p => v.root + p)))
            delete code.subPackages

        }

        if (mapping.ignorePage && mapping.ignorePage.length) {
            let reg
            code.pages = code.pages.filter(v => !(mapping.ignorePage.find(i => {
                reg = new RegExp(v)
                return reg.test(i)
            })))
        }


        if (code.window) {
            code.window = jsonPropTransform(code.window)
        }
        if (code.tabBar) {
            if (code.tabBar.list) {
                let list = []
                code.tabBar.list.forEach((v, i) => {
                    //如果有不需要的tabbar页面 需要删掉
                    if (mapping.ignoreTabbarPage && mapping.ignoreTabbarPage.length) {
                        delTabBarIndex = mapping.ignoreTabbarPage.findIndex(item => item === v.pagePath)
                        if (delTabBarIndex === -1) {
                            list.push(jsonPropTransform(v))
                        }
                    }
                    // code.tabBar.list[i] = jsonPropTransform(v)
                })
                code.tabBar.list = list
            }
            code.tabBar = jsonPropTransform(code.tabBar)
        }
    } else {
        if (code) {
            code = jsonPropTransform(code)
        }
    }

    return prettier.format(JSON.stringify(code), {
        semi: false,
        parser: 'json'
    })



    function jsonPropTransform(options) {
        let key
        let value
        let newOptions = {}
        Object.keys(options).forEach(v => {
            key = mapping.json[v]
            value = options[v]
            if (key) {
                newOptions[key] = value
                if (mapping.json[v + '_' + value]) {
                    newOptions[key] = mapping.json[v + '_' + value]
                }
            } else {
                newOptions[v] = v === 'usingComponents' ? usingComponentsTramsform(value) : value
            }
        })
        return newOptions
    }

    function usingComponentsTramsform(obj) {
        let keys = Object.keys(obj)
        let firstChar
        let firstPathName
        let newKey
        let newObj = {}
        if (!keys.length) return obj
        keys.forEach(key => {
            newKey = key.toLocaleLowerCase()
            firstChar = obj[key].substring(0, 1)
            if (/@/.test(obj[key]) || firstChar === '.' || firstChar === '/') return (newObj[newKey] = obj[key])
            firstPathName = obj[key].split('/')[0]
            if (projectPackageJson.dependencies[firstPathName]) return (newObj[newKey] = obj[key])
            newObj[newKey] = './' + obj[key]
        })
        return newObj
    }
}

async function jsonFileTransform(mapping, newProjectPath, filePath, toAppType, toFilePath, rootPath) {

    let fileConent
    projectPackageJson = require(path.join(rootPath, newProjectPath, '/package.json'))
    fileConent = await getFileContent(filePath, 'utf-8')

    if (toAppType !== 'wx') {
        fileConent = JSON.parse(fileConent)
        fileConent = transform(fileConent, mapping, filePath)
    }

    saveFile(toFilePath ? toFilePath : filePath, fileConent)

}



module.exports = jsonFileTransform