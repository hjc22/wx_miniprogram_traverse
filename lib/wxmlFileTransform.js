const {
    saveFile,
    getFileContent,
    getFileAfterName,
    updateFileAfterName,
} = require('./utils')
const {
    parse,
    generate
} = require('parsewxml')

/**
 * 转化微信小程序布局文件 => 其他小程序  
 *
 * @param {array}  files        wxml文件数组`
 * @param {object} allMapping   差异性文件
 */
async function wxmlFileTransform(allMapping, toPath, filePath, toAppType, toFilePath) {

    let content


    content = await getFileContent(filePath, 'utf-8')

    // return console.log(888)
    if (!content) return

    if (toAppType !== 'wx') {
        content = '<null-tag>' + content + '</null-tag>'
        let hasLoading = false
        let tree = parse(content, node => {
            // console.log(node);
            let name = node.name
            let attrs = node.attrsMap
            let key
            let isWxsTag = node.name === 'wxs'
            let isUnSupportHiddenTag = allMapping.unSupportHiddenTags ? allMapping.unSupportHiddenTags.find(v => v === node.name) : false
            let newAttrs = {}
            node.name = node.name ? node.name.toLocaleLowerCase() : ''
            if (node.type === 'tag' && allMapping.tags[name]) {
                if (node.name === 'loading') {
                    hasLoading = true;
                    newAttrs['is'] = 'loading'
                }
                node.name = allMapping.tags[name]
            }

            for (key in attrs) {
                if (allMapping.attrs[key]) {
                    newAttrs[allMapping.attrs[key]] = attrs[key]
                } else if (key === 'src') {
                    let value = attrs[key]
                    let afterName = getFileAfterName(value)
                    if (afterName && allMapping.fileFormatName[afterName]) {
                        value = updateFileAfterName(value, allMapping.fileFormatName[afterName])
                    }

                    if (!(/\{\{|http/.test(value)) && !(value[0] === '.' || value[0] === '/')) {
                        value = './' + value
                    }
                    newAttrs[isWxsTag ? allMapping.wxs[key] : key] = value
                } else if (key === 'hidden' && (isUnSupportHiddenTag || hasLoading)) {
                    newAttrs[allMapping.attrs['wx:if']] = hiddenValueUpdate(attrs[key])
                } else {
                    let eventResult = isWxsTag ? allMapping.wxs[key] : allMapping.eventNameCheck && typeof allMapping.eventNameCheck === 'function' ? allMapping.eventNameCheck(key) : key
                    let newKey = isWxsTag ? eventResult : eventResult === key ? /data\-/.test(key) ? key.toLocaleLowerCase() : key : eventResult
                    newAttrs[newKey] = attrs[key]
                }
            }
            node.attrsMap = newAttrs
        })
        if (hasLoading) {
            tree.children.unshift({
                type: 'tag',
                name: 'import',
                attrsMap: {
                    src: '/common/templates/loading/index.axml'
                },
                parent: undefined,
                unary: true,
                children: []
            }, {
                type: 'text',
                text: '\r\n'
            });
        }
        content = generate(tree.children)
    }

    saveFile(toFilePath ? toFilePath : filePath, content, 'utf-8')
    // console.info('转换', filePath, '文件', '成功'.yellow)
}



function hiddenValueUpdate(val) {
    let newValue = getTwoCharBeTweenContent(val)
    return val && newValue ? `{{!(${newValue})}}` : val
}

function getTwoCharBeTweenContent(str) {
    let val
    val = str.match(/{{([\S\s]*)}}/)
    return val ? val[1] : null
}

module.exports = wxmlFileTransform