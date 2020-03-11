const fs = require('fs')
const {
    promisify
} = require('util')
const recursiveCopy = require('recursive-copy')

const saveFile = promisify(fs.writeFile)
const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)
const renameFile = promisify(fs.rename)
const path = require('path')
const rmdir = require("rmdir-promise");
const getFileContent = promisify(fs.readFile)
const nodeModulesDistList = []
const wxFileAfterNameList = ['js', 'wxss', 'json', 'wxml', 'wxs']
let watchFileQueue = []
let watchFileUpdateTimer = null
/**
 * 通过文件路径获取后缀名
 *
 * @param {string} fileName   文件名
 * @returns {string}
 */
const getFileAfterName = function (fileName) {
    if (!fileName) return ''
    let n = path.extname(fileName).replace('.', '')
    return n || ''
}


/**
 * 通过文件路径获取文件名
 *
 * @param {string} path   文件路径
 * @returns {string}
 */
const getFileName = function (path) {
    if (!path) return ''
    let f = /\//.test(path) ? '/' : '\\'
    let splits = path.split(f)
    return splits[splits.length - 1]
}


/**
 * 更改文件后缀名
 *
 * @param {string} fileName   旧文件名
 * @param {string} newAfterName  新文件名
 * @returns {string}
 */
const updateFileAfterName = function (fileName, newAfterName) {
    if (!fileName || !newAfterName) return fileName
    let splits = fileName.split('.')
    splits[splits.length - 1] = newAfterName
    return splits.join('.')
}

//
/**
 * 复制项目
 *
 * @param {string} fromPath   原项目路径
 * @param {string} toPath     转换后的项目路径
 * @param {object} fileAfterNameMapping   文件后缀名映射
 * @param {string} toAppType   平台类型
 * @param {reg} checkOtherAppTypeReg  检测是否是其他平台类型正则
 * @param {reg} checkAppTypeReg       检测是否是平台类型文件正则
 * @param {boolean} isUpdateNodeModules  是否更新node模块文件
 * @param {boolean} isInit               是否是首次复制项目
 * @returns
 */
const copyProject = async function (fromPath, toPath, fileAfterNameMapping, toAppType, checkOtherAppTypeReg, checkAppTypeReg, isUpdateNodeModules, isInit) {
    // if (fs.existsSync(toPath)) return

    let options = {
        overwrite: true,
        expand: true,
        dot: true,
        filter(fileName) {
            let isNofile = /(miniprogram\_npm|DS_store)/i.test(fileName)
            let isOtherAppType
            let isNowAppType

            if (isNofile) {
                return
            } else {
                isOtherAppType = checkOtherAppTypeReg.test(fileName)
                isNowAppType = checkAppTypeReg.test(fileName)

                if (toAppType === 'wx') return !isOtherAppType
                if (isNowAppType) return true
                else if (isOtherAppType) {
                    return
                } else return true
            }
            // return toAppType === 'wx'?(isNofile || !isOtherAppType):(isNofile || (isNowAppType && ))1`
        },
        rename: function (filePath) {
            let afterName = getFileAfterName(filePath)
            let newAfterName = fileAfterNameMapping[afterName]
            if (newAfterName) {
                filePath = updateFileAfterName(filePath, newAfterName)
            }
            // if (toAppType !== 'wx' && /miniprogram_npm/.test(filePath)) {
            //     filePath = filePath.replace('miniprogram_npm', 'node_modules')
            // }
            return filePath
        },
    }
    await recursiveCopy(fromPath, toPath, options)
    if (toAppType === 'zfb' && isInit) await addFitModule(toAppType)
    if (toAppType === 'zfb' && isUpdateNodeModules) await handleNodeModules(path.join(toAppType + '_dist', 'node_modules'))


}


/**
 *
 * 获取当前目录下的文件， 目录
 * @param {string}   dirName               目录路径
 * @param {object}   options               配置项
 * @param {function} options.fileFilter    配置文件过滤函数，return true|false
 * @returns
 */
const getDirFile = async function (dirName, {
    fileFilter
} = {}) {
    let result = {
        files: [],
        dirs: []
    }
    let files = await readdir(dirName)
    let isFileFilterFn = typeof fileFilter === 'function'
    let name
    files.forEach(itemDirent => {
        name = path.join(dirName, itemDirent)
        if (fs.statSync(name).isDirectory()) result.dirs.push(name)
        else {
            let afterName = getFileAfterName(itemDirent)

            isFileFilterFn ? (fileFilter(name) && result.files.push({
                name,
                afterName
            })) : result.files.push({
                name,
                afterName
            })
        }
    })
    return result
}

/**
 * 开启项目监听
 *
 * @param {*} {
 *     fromPath,                原项目路径
 *     projectPath,             新项目路径
 *     allMapping,              转换平台映射表
 *     checkAppTypeReg,         检查是否是当前平台类型文件正则
 *     replaceAppTypeReg,       清除当前平台类型文件名正则
 *     checkOtherAppTypeReg,    检查是否是其他平台类型文件正则
 *     toAppType                当前平台类型
 * }
 * @param {function} callback          监听回调
 * 
 */
const projectWatch = function ({
    fromPath,
    projectPath,
    allMapping,
    checkAppTypeReg,
    replaceAppTypeReg,
    checkOtherAppTypeReg,
    toAppType
}, callback) {

    let prevChange = {

    }

    return fs.watch(fromPath, {
        recursive: true
    }, async (eventType, filename) => {
        console.log(eventType, filename)
        if (filename) {
            if (/\.DS_Store/.test(filename) || (/miniprogram\_npm/.test(filename) && toAppType !== 'wx')) return
            //是否是node_modules目录文件
            let isNodeModulesFile
            if (toAppType !== 'wx') {
                isNodeModulesFile = /node\_modules/.test(filename)
            }
            let name = path.join(fromPath, filename)
            //watch后需要写入的文件路径
            let toFilePath = path.join(projectPath, filename)
            //旧的文件后缀名
            let oldAfterName = getFileAfterName(filename)
            //需要写入的文件后缀名
            let afterName = oldAfterName
            //微信文件后缀名对应平台的文件后缀名
            let newAfterName = allMapping.fileFormatName[afterName]
            //是否是当前平台类型文件
            let isNowAppType = checkAppTypeReg.test(name)

            if (isNodeModulesFile) {
                toFilePath = getNodeModulesPath(toFilePath)
                console.log('node_modules 文件更新，请点击开发者工具重新编译，微信平台需要重新构建npm'.yellow)
            }
            if (newAfterName) {
                toFilePath = updateFileAfterName(toFilePath, newAfterName)
                afterName = newAfterName
            }
            if (!isNowAppType) {
                if (checkOtherAppTypeReg.test(name)) {
                    return console.log('其他平台文件更新 无需编译'.yellow)
                }
            } else {
                toFilePath = replaceFileName(toFilePath, replaceAppTypeReg)
            }
            if (eventType === 'rename') {
                try {
                    fileStat = await stat(name)
                    if (fileStat.isDirectory()) {

                        await copyProject(name, toFilePath, allMapping.fileFormatName, toAppType, checkOtherAppTypeReg, checkAppTypeReg, isNodeModulesFile)
                        return callback(toFilePath)
                    }
                } catch (err) {
                    if (err.errno === -2) {
                        fs.unlink(toFilePath, (err) => {
                            if (err) {
                                // console.error('unlink:', err)
                                console.log(toFilePath, ' 目录', '删除'.blue)
                                rmdir(toFilePath).catch(err => {
                                    // console.error('rmdir:', err)
                                })
                            } else {
                                console.log(toFilePath, ' 文件', '删除'.blue)
                            }
                        })
                    }
                    return
                }

            }
            if (!afterName || wxFileAfterNameList.indexOf(oldAfterName) === -1) return fs.copyFile(name, toFilePath, (err) => {
                err && console.log(err)
            })

            // console.log()

            if (checkFileIsNowAppType(name, oldAfterName, toAppType)) return console.log('非当前平台适配文件，无需更新'.yellow)


            fileUpdateHandle(name, toFilePath, afterName, prevChange, callback)

        }
    });
}


/**
 * 替换文件名
 *
 * @param {string} name  文件名或者文件路径
 * @param {reg} reg  替换字符的正则
 * @param {string} [value='']   替换为的值
 * @returns {string}
 */
function replaceFileName(name, reg, value = '') {
    return name.replace(reg, value)
}

/**
 * 检测该文件是否有存在当前平台类型的适配文件
 *
 * @param {string} name    文件名
 * @param {string} afterName   文件后缀名
 * @param {string} toAppType   平台类型
 * @returns {boolean}
 */
function checkFileIsNowAppType(name, afterName, toAppType) {
    name = name.replace('.' + afterName, '-apptype-' + toAppType + '.' + afterName)
    return fs.existsSync(name)
}

/**
 *  获取node_modules 路径
 *
 * @param {string} filePath
 * @returns {string}
 */
function getNodeModulesPath(filePath) {
    // if(/@/.test(filePath)){}
    let val = nodeModulesDistList.find(v => new RegExp(v).test(filePath))

    return val ? filePath.replace(val.miniprogramDist, '') : val
}

/**
 * 文件监听变化后的执行回调,做了一个优化相同的文件如果100ms内多次变化以最后一次为准
 *
 * @param {string} name   文件名
 * @param {string} toFilePath   转换后的文件路径地址
 * @param {string} afterName    文件后缀名
 * @param {object} prevChange   上次执行文件变化的缓存
 * @param {function} callback   监听的回调
 */
function fileUpdateHandle(name, toFilePath, afterName, prevChange, callback) {
    if (watchFileQueue.findIndex(v => v.name === name) !== -1) return
    clearTimeout(watchFileUpdateTimer)
    watchFileUpdateTimer = null
    watchFileQueue.push({
        toFilePath,
        name,
        afterName
    })
    watchFileUpdateTimer = setTimeout(() => {
        watchFileQueue.forEach(callback)
        watchFileQueue = []
        watchFileUpdateTimer = null
    }, 400)
}

/**
 *  对node_modules依赖包的处理，因为微信版本的npm包多了一层目录，需要去除掉
 *
 * @param {string} dirPath   目录路径
 */
async function handleNodeModules(dirPath) {
    let {
        dirs
    } = await getDirFile(dirPath)
    dirs.forEach(async dir => {
        try {
            if (/@/.test(getFileName(dir))) {
                return await handleNodeModules(dir)
            }
            let json = await getFileContent(path.join(dir, 'package.json'))
            if (!json) return
            json = JSON.parse(json)
            let miniprogramDist = json.miniprogram || 'miniprogram_dist'
            let allMiniprogramDist = path.join(dir, miniprogramDist)

            let files = await readdir(allMiniprogramDist)

            let options = {
                overwrite: true,
                expand: true
            }
            files.forEach(async (file, i) => {
                nodeModulesDistList.push({
                    name: file,
                    miniprogramDist: miniprogramDist
                })
                await recursiveCopy(path.join(allMiniprogramDist, file), path.join(dir, file), options)
                if (i === files.length - 1) await rmdir(allMiniprogramDist).catch(() => { })
            })
        } catch (err) {
            return
        }

    })
}

/**
 * 复制处理后的node_modules倒转换平台的目录下
 *
 * @param {string} toAppType  转换的平台类型
 */
async function addFitModule(toAppType) {
    await recursiveCopy('node_modules/wx_traverse_fit', path.join(toAppType + '_dist', 'node_modules/wx_traverse_fit'), {
        overwrite: true,
        expand: true
    })
}

module.exports = {
    getFileContent,
    saveFile,
    getFileAfterName,
    updateFileAfterName,
    copyProject,
    getFileName,
    getDirFile,
    projectWatch,
    renameFile
}