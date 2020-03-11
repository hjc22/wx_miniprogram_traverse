/**
 * 微信小程序和其他小程序差异性文件 
 * dev: 黄静超
 */

module.exports = {
    projectPath: __dirname + '/Src',
    zfbMapping: {
        //是否更新url path 和 host
        isUpdateRequestName: true,
        istransfromScss: true,
        //忽略转换的小程序页面
        ignorePage: [],
        //忽略转换的文件
        ignoreFileList: {
            js: [
                filePath => /deploy\_/.test(filePath)
            ]
        },
        //自定义组件的自定义事件名称转换
        eventNameCheck: function (name) {
            if (!name) return ''
            let first
            if (/bind/.test(name)) {
                name = name.replace(/bind/, '')
                first = name[0].toLocaleUpperCase()
                name = 'on' + first + name.substring(1, name.length)
            }
            return name
        },
        //文件格式
        fileFormatName: {
            'wxml': 'axml',
            'wxss': 'acss',
            'wxs': 'sjs',
        },
        //组件标签
        tags: {
            'wxs': 'import-sjs',
            'loading': 'template'
            // 'cover-view': 'view',
            // 'cover-image': 'image'
        },
        wxs: {
            'module': 'name',
            'src': 'from'
        },
        //组件属性
        attrs: {
            'wx:if': 'a:if',
            'wx:else': 'a:else',
            'wx:elif': 'a:elif',
            'wx:for': 'a:for',
            'wx:for-item': 'a:for-item',
            'wx:for-index': 'a:for-index',
            'wx:key': 'a:key',
            'wx:scope-data': 'scope-data',
            //事件
            'bindtap': 'onTap',
            'catchtap': 'catchTap',
            'bindtouchstart': 'onTouchStart',
            'catchtouchstart': 'catchTouchStart',
            'bindtouchmove': 'onTouchMove',
            'catchtouchmove': 'catchTouchMove',
            'bindtouchend': 'onTouchEnd',
            'catchtouchend': 'catchTouchEnd',
            'bindinput': 'onInput',
            'bindtouchcancel': 'onTouchCancel',
            'catchtouchcancel': 'catchTouchCancel',
            'bindlongpress': 'onLongTap',
            'bindlongtap': 'onLongTap',
            'catchlongpress': 'catchLongTap',
            'catchlongtap': 'catchLongTap',
            //地图
            'bindchange': 'onChange',
            'bindregionchange': 'onRegionChange',
            'bindmarkertap': 'onMarkerTap',
            'bindcallouttap': 'onCalloutTap',
            'bindtransitionend': 'onTransitionEnd',
            //scroll-view
            'bindscrolltoupper': 'onScrollToUpper',
            'bindscrolltolower': 'onScrollToLower'
        },
        //json文件配置
        json: {
            'navigationBarTitleText': 'defaultTitle',
            'navigationBarBackgroundColor': 'titleBarColor',
            'enablePullDownRefresh': 'pullRefresh',
            'text': 'name',
            'color': 'textColor',
            'iconPath': 'icon',
            'selectedIconPath': 'activeIcon',
            'list': 'items',
            'disableScroll': 'allowsBounceVertical',
            'disableScroll_true': 'NO',
            'disableScroll_false': 'YES'
        },
        //自定义组件
        component: {
            "properties": 'props',
            "ready": 'didMount',
            "moved": "didUpdate",
            "detached": "didUnmount",
        },
        //特殊变量名修改
        identifierNames: [
        ],
        //需要修改的字符串的值
        stringUpdateNames: [

        ],
        //不支持hidden属性的标签
        unSupportHiddenTags: ['scroll-view', 'icon'],
        //自定义组件是否需要挂载到父页面的实例上,需要填上组件名，组件名就是自定义组件文件名
        mountToPageComponents: ['btnFloatLayer', 'searchHeader'],
        //公共的接口host
        publicRequestHost: {
            hostName: 'ALI_CLIENT_TUJIA_HOST',
        },
        //需要转化的请求path
        requestPaths: {

            //首页
            'ALI_CLIENT_TUJIA_HOST': {

            },
            'PASSPORT_TUJIA_HOST': {

            },
            'WXCUSTOMER_TUJIA_HOST': {
                //登录、全局配置
                // '/WebPartsWechat/config/Global': '',
                // '/Customer/User/SendVerCode': '',
                // '/Customer/User/GetImageVerifyCode': '',
            },
            'WXPAY_TUJIA_HOST': {
                //支付
                '/WeixinMINA/send': '/ch/pay/applet/{sign}.htm',
            }
        },
        //需要转化的请求host
        requestHosts: {
            'WXCLIENT_TUJIA_HOST': 'ALI_CLIENT_TUJIA_HOST',
            'WXCUSTOMER_TUJIA_HOST': 'ALI_CLIENT_TUJIA_HOST',
            'WX_ORDER_TUJIA_HOST': 'ALI_CLIENT_TUJIA_HOST',
            'WXPAY_TUJIA_HOST': 'ALI_CLIENT_TUJIA_HOST'
        },
        // delRequestHost: [
        //     'WXCLIENT_TUJIA_HOST'
        // ]
    },
    wxMapping: {
        fileFormatName: {
            'wxml': 'wxml',
            'wxss': 'wxss',
            'wxs': 'wxs',
        },
        istransfromScss: true
    }
}