#!/usr/bin/env node

/**
 * 微信小程序转换其他小程序 
 * dev: 黄静超
 */


const path = require('path')
const fs = require('fs')
require('console-color-mr');
const {
    copyProject,
    getDirFile,
    projectWatch,
    renameFile,
    saveFile
} = require('./lib/utils')
const ora = require('ora')

let mapping
const transforms = require('./lib');
const rmdir = require("rmdir-promise");
const program = require('commander');
const rootPath = process.cwd()


// //检查node版本
// if (!checkNodeVersion()) {
//     return console.error(process.version, '请升级你的node版本到10.0.0以上，打开', 'http://nodejs.cn/download/ 下载'.white)
// }

//tjmpt命令参数
program
    .version('1.0.0')
    .usage('[options] [fromPath]')
    .option('-w, --watch', 'no all tranform,only open watch. explame: tjmpt -w -x')
    .option('-x, --wx [wx]', 'to wx miniprogram')
    .option('-z, --zfb [zfb]', 'to zfb miniprogram')
    .option('-g, --gd [gd]', 'to gaode miniprogram')
    .option('-u, --unWatch', 'no open watch')
    .parse(process.argv)

//当前支持的平台关系
const typeNames = {
    zfb: '支付宝',
    wx: '微信',
    gd: '高德'
}

getMappingFile()


//原项目路径
let fromPath
//转换的平台
let mode

Object.keys(typeNames).forEach(v => {
    mode = program[v] ? v : mode
})

process.env.APP_TYPE = mode

if(mode === 'gd'){
    mode = 'zfb'
    program[mode] = true
}

fromPath = program[mode] !== true ? program[mode] : mapping.projectPath

if (!fromPath) {
    return console.error('请指定需要转换的项目地址，在miniprogram-mapping.js的projectPath属性填写')
}
if (!mode) return program.help()

//项目转换后路径
let toPath
let projectPath
//转换的平台类型
let toAppType
let toAppTypeName
//映射配置
let allMapping
//检测当前平台类型正则
let checkAppTypeReg
//替换平台类型正则
let replaceAppTypeReg
//检测其他平台类型正则
let checkOtherAppTypeReg
//检测文件后缀名正则
let filterFileReg


let spinner



main()



/**
 * 项目主函数
 *
 */
async function main() {
    setGlobalOptions() 
    console.log('\n')
    spinner = ora(`正在转换成${toAppTypeName}小程序\n`)
    initTransform()
}


/**
 * 设置全局的配置参数
 *
 */
function setGlobalOptions() {
    toAppType = mode
    toAppTypeName = typeNames[program.gd ? 'gd' : toAppType]
    toPath = path.join(toAppType + '_dist')
    allMapping = mapping[(program.gd ? 'gd' : toAppType) + 'Mapping']
    checkAppTypeReg = new RegExp('-' + toAppType)
    checkOtherAppTypeReg = new RegExp('-apptype-')
    replaceAppTypeReg = new RegExp('-apptype-' + toAppType)
    filterFileReg = toAppType === 'wx' ? new RegExp('wxss') : new RegExp(`(js|json|${allMapping.fileFormatName.wxml}|${allMapping.fileFormatName.wxss})$`)
    projectPath = toPath
}

/**
 * 开始转换代码
 *
 */
async function initTransform() {
    //有watch选项 只会开启watch 不会全项目编译
    if (!program.watch) {
        spinner.start()
        await rmdir(toPath).catch(() => {})
        // 复制项目
        await copyProject(fromPath, toPath, allMapping.fileFormatName, toAppType, checkOtherAppTypeReg, checkAppTypeReg, true, true)
        await fileTransform(toPath)
        spinner.stop()
    }
    !program.unWatch && startProjectWatch(fromPath, toPath)
    console.log(toAppTypeName, '小程序转换成功'.blue, !program.unWatch ? ' 已开启热转换,原项目直接编辑即可\n' : '')
}



/**
 * 文件转换方法
 *
 * @param {string} toPath   转换后的路径
 * @returns
 */
async function fileTransform(toPath) {

    return new Promise(async (resolve, reject) => {

        let {
            files,
            dirs
        } = await getDirFile(toPath, {
            fileFilter(fileName) {
                return filterFileReg.test(fileName)
            },
        })

        let newFiles = []
        //保留需要转换平台的文件，去除其他平台的文件
        files.forEach(async (fileInfo, i) => {
            let {
                name
            } = fileInfo
            let isAppType = checkAppTypeReg.test(name)
            let isOtherAppType = checkOtherAppTypeReg.test(name)

            if (isOtherAppType) {
                if (isAppType) {
                    try {
                        fs.renameSync(name, name.replace(replaceAppTypeReg, ''))
                    } catch (err) {

                    }
                } 

            } else {
                newFiles.push(fileInfo)
            }
        })

        let count = 0
        let arrs = [...newFiles, ...dirs]
        if (!arrs.length) resolve();

        arrs.forEach(async (v, i) => {
            if (typeof v === 'string') {
                await fileTransform(v, filterFileReg, allMapping)
            } else {
                await swtichFileTypeTransform(v)
            }
            count++
            if (count == arrs.length) {
                resolve()
            }

        })
    })
}

/**
 * 判断文件类型执行对应转换方法
 *
 * @param {object} fileInfo    文件的信息 路径 名称  后缀名
 */
async function swtichFileTypeTransform(fileInfo) {
    let args = [allMapping, projectPath, fileInfo.name, toAppType, fileInfo.toFilePath, rootPath]
    let fileFormatName = allMapping.fileFormatName

    try {
        switch (fileInfo.afterName) {
            case fileFormatName.wxml:
                await transforms.wxmlFileTransform(...args)
                break;
            case 'json':
                await transforms.jsonFileTransform(...args)
                break;
            case 'js':
                await transforms.jsFileTransform(...args)
                break;
            case fileFormatName.wxss:
                await transforms.wxssFileTransform(...args)
                break;
            case fileFormatName.wxs:
                await transforms.wxsFileTransform(...args)
                break;
            default:
                try{
                    await fs.copyFile(fileInfo.name,fileInfo.toFilePath,(err) => {
                        err && console.log(err)
                    })
                }
                catch(e){
                    console.error('其他文件类型错误：',fileInfo.toFilePath,e)
                }
                
                break;
        }
    } catch (err) {
        console.error('错误文件: ', fileInfo.name)
        console.log(err)
    }

}


/**
 * 监听原项目路径
 *
 * @param {string} fromPath    原项目路径
 * @param {string} toPath      转换后项目路径
 */
function startProjectWatch(fromPath, toPath) {
    projectWatch({
        toAppType,
        fromPath,
        projectPath: toPath,
        allMapping,
        checkAppTypeReg,
        replaceAppTypeReg,
        checkOtherAppTypeReg
    }, fileInfo => {

        // console.log(fileInfo)
        let isDir = typeof fileInfo === 'string'
        if (isDir) {
            fileTransform(fileInfo)
        } else {
            swtichFileTypeTransform(fileInfo)
        }
        console.log(isDir ? fileInfo : fileInfo.toFilePath, isDir ? ' 目录' : ' 文件', ' 重新编译'.blue, '\n')
    })
}


/**
 * 获取映射配置文件
 *
 */
function getMappingFile() {
    let configPath
    configPath = path.join(rootPath, 'miniprogram-mapping.js')
    try {
        if (!fs.statSync(configPath).isFile()) {
            configPath = './lib/attributeMapping'
        }
    } catch (err) {
        configPath = './lib/attributeMapping'
    }

    mapping = require(configPath)
}
/**
 * 检测node版本
 *
 */
function checkNodeVersion() {
    let v = process.version.replace('v', '')
    v = v.split('.')
    return v[0] >= 10
}
