const babylon = require("babylon");
const traverse = require("babel-traverse").default;
const generator = require("babel-generator").default;
const t = require("babel-types");
const babelCore = require("babel-core")
const {
  saveFile,
  getFileContent
} = require("./utils");

//VariableDeclaration 声明变量标识符 var let const
//"VariableDeclarator" 声明变量语句
//Identifier 变量名 函数名
//NumericLiteral 数字类型的值
//"StringLiteral" 字符串类型的值
//"ExpressionStatement"  表达式
//CallExpression  函数表达式
//"ObjectExpression" 对象表达式
//"ObjectProperty"  对象属性

/**
 * js文件转换
 *
 * @param {string} code   代码字符串
 * @param {string} mapping     映射配置
 * @param {string} filePath    文件路径
 * @param {string} toAppType   平台类型
 * @returns
 */
function transform(code, mapping, filePath, toAppType) {
  let result;
  let {
    requestPaths = {},
    requestHosts = {},
    ignoreFileList,
    publicRequestHost,
    isUpdateRequestName,
    mountToPageComponents,
    stringUpdateNames,
    isAddTujiaBury
  } = mapping;

  if (ignoreFileList && ignoreFileList.js) {
    if (
      ignoreFileList.js.find(
        v => (typeof v === "function" ? v(filePath) : v === filePath)
      )
    ) {
      if (isUpdateRequestName) {
        return filterConfigHost(
          code,
          requestHosts,
          publicRequestHost,
          filePath,
          toAppType
        );
      }
      return code;
    }
  }

  try {
    result = babylon.parse(code, {
      sourceType: "module",
      plugins: "*"
    });
  } catch (err) {
    console.error("js转换错误", err, filePath);
  }

  let isComponent, isPage, isApp;
  let props = [];
  let componentName;
  let isMountComponentToPage;
  let isGIO;
  let isAddTjApi;
  let isNodeModule = /node_modules/.test(filePath)

  let vistor = {
    CallExpression(path) {
      // console.log(path.node)
      let node = path.node;
      let key;
      let methods;
      if (node.callee.name === "Component") {
        // isAddTjApi = true
        let componentArg = node.arguments[0];
        let componentProperties = componentArg.properties;
        methods = componentProperties.find(v => v.key.name === "methods");
        if (!methods) {
          methods = t.objectProperty(
            t.identifier("methods"),
            t.ObjectExpression([])
          );
          componentProperties.push(methods);
        }
        isComponent = true;
        // if (toAppType === 'zfb') {

        //     isAddTjApi = zfbAddComponentFitToComponentFile(result,isAddTjApi)
        // }
        if (filePath) {
          let splitString = /\//.test(filePath) ? "/" : "\\";
          let s = filePath.split(splitString);
          componentName = s[s.length - 2];
          if (componentName) {
            isMountComponentToPage = !!mountToPageComponents.find(
              v => v === componentName
            );
          }
        }

        if (
          componentArg &&
          componentArg.properties &&
          componentArg.properties.length
        ) {
          let lifeList = [];
          for (let i = 0; i < componentArg.properties.length; i++) {
            key = mapping.component[componentArg.properties[i].key.name];
            if (key) {
              componentArg.properties[i].key.name = key;
            }

            if (key === "props") {
              //微信小程序和支付宝小程序自定义组件差异性太大 转换成支付宝规范 prop observer转成methods下方法
              componentArg.properties[i].value.properties.forEach(prop => {
                props.push(prop.key.name);
                if (t.isObjectExpression(prop.value)) {
                  let propsValueNode;
                  prop.value.properties.forEach((v, i) => {
                    if (
                      (t.isObjectMethod(v) || t.isProperty(v)) &&
                      v.key.name === "observer"
                    ) {
                      v.key.name = prop.key.name + "PropsObserver";
                      methods.value.properties.push(v);
                      prop.value.properties.splice(i);
                    } else if (t.isObjectProperty(v) && v.key.name === "type") {
                      v.value.name = dataTypeTransform(v.value.name);
                      propsValueNode = v.value;
                    } else if (
                      t.isObjectProperty(v) &&
                      v.key.name === "value"
                    ) {
                      propsValueNode = v.value;
                    }
                  });
                  if (propsValueNode) {
                    prop.value = propsValueNode;
                  }
                }
              });
            }
            if (
              componentArg.properties[i].key.name === "created" ||
              componentArg.properties[i].key.name === "didMount"
            ) {
              lifeList.push(componentArg.properties[i]);
            }
          }

          let mountToPageNode = isMountComponentToPage ?
            t.expressionStatement(
              t.assignmentExpression(
                "=",
                t.memberExpression(
                  t.memberExpression(
                    t.thisExpression(),
                    t.identifier("$page")
                  ),
                  t.identifier(componentName)
                ),
                t.thisExpression()
              )
            ) :
            null;
          //处理支付宝没有created的情况 同时在生命周期didMount里加上 挂载到页面page

          if (lifeList.length) {
            let didMount = lifeList.find(v => v.key.name === "didMount");
            let createdIndex = componentArg.properties.findIndex(
              v => v.key.name === "created"
            );
            let created =
              createdIndex == -1 ? null : componentArg.properties[createdIndex];
            if (didMount && created) {
              let body = t.isObjectProperty(created) ?
                created.value.body.body :
                created.body.body;
              if (t.isObjectProperty(didMount)) {
                didMount.value.body.body = body.concat(
                  didMount.value.body.body
                );
                mountToPageNode &&
                  didMount.value.body.body.unshift(mountToPageNode);
              } else if (t.isObjectMethod(didMount)) {
                didMount.body.body = body.concat(didMount.body.body);
                mountToPageNode && didMount.body.body.unshift(mountToPageNode);
              }

              if (created) {
                componentArg.properties.splice(createdIndex, 1);
              }
            } else if (created || didMount) {
              if (created) {
                created.key.name = "didMount";
              }
              let finalNode = created || didMount;

              if (t.isObjectProperty(finalNode)) {
                mountToPageNode &&
                  finalNode.value.body.body.unshift(mountToPageNode);
              } else if (t.isObjectMethod(didMount)) {
                mountToPageNode && finalNode.body.body.unshift(mountToPageNode);
              }
            }
          } else {
            mountToPageNode &&
              componentArg.properties.push(
                t.objectMethod(
                  "method",
                  t.identifier("didMount"),
                  [],
                  t.blockStatement([mountToPageNode])
                )
              );
          }
        }
      } else if (node.callee.name === "App") {
        isApp = true;
        node.arguments[0].properties.unshift(
          t.objectProperty(
            t.identifier("miniprogramType"),
            t.stringLiteral(toAppType)
          )
        );
      } else if (node.callee.name === "Page") {
        isPage = true;
      }
      //处理其他端小程序不支持的selectComponent方法
      if (
        t.isMemberExpression(node.callee) &&
        node.callee.property.name === "selectComponent"
      ) {
        path.replaceWith(
          t.memberExpression(
            t.thisExpression(),
            t.identifier(node.arguments[0].value.replace("#", ""))
          )
        );
      }
      //支付宝小程序里不需要in(this)
      if (
        t.isMemberExpression(node.callee) &&
        node.callee.property.name === "in" &&
        node.callee.object
      ) {
        path.parentPath.get("object").replaceWith(node.callee.object);
      }
    },
    //处理 props
    MemberExpression(path) {
      if (!isComponent) return;
      if (
        t.isMemberExpression(path.node.object) &&
        (t.isIdentifier(path.node.object.property, {
          name: "data"
        }) ||
          t.isIdentifier(path.node.object.property, {
            name: "properties"
          })) &&
        props.find(v => path.node.property.name === v)
      ) {
        path.get("object").replaceWithSourceString("this.props");
      }
    },
    //处理 var isAliApp = process.env.APP_TYPE === 'zfb'
    BinaryExpression(path) {
      const node = path.node
      if (node.left.property && node.left.property.name === 'APP_TYPE') {
        path.replaceWithSourceString(eval(`'${process.env.APP_TYPE}' ${node.operator} '${node.right.value}'`))
      }
    },
    //处理process.env.APP_TYPE === 
    IfStatement(path) {
      if (path.parentKey != "alternate") {
        // console.log('IfStatement', path, path.node)
        let node = path.node
        getAppType(path, node)
      }
    },
    //处理 props
    VariableDeclaration(path) {
      if (!isGIO) {
        path.node.declarations.forEach((dItem, dIndex) => {
          if (dItem.id.name === "gio") {
            path.node.declarations[dIndex].init = t.arrowFunctionExpression(
              [],
              t.blockStatement([])
            );
          }
        });
        isGIO = true;
      }

      if (!isComponent) return;
      path.node.declarations.forEach((dItem, dIndex) => {
        if (t.isObjectPattern(path.node.declarations[dIndex].id)) {
          let isPropList = [];
          dItem.id.properties.forEach((v, i) => {
            if (props.find(p => p === v.key.name)) {
              isPropList.push(v.key.name);
            }
          });
          if (
            isPropList.length &&
            dItem.id.properties.length === isPropList.length
          ) {
            if (path.node.declarations[dIndex].init.property) {
              path.node.declarations[dIndex].init.property.name = "props";
            }
          } else if (isPropList.length) {
            path.node.declarations[
              dIndex
            ].id.properties = dItem.id.properties.filter(
              v => !isPropList.find(p => p === v.key.name)
            );
            path.parent.body.unshift(
              t.variableDeclaration("let", [
                t.variableDeclarator(
                  t.ObjectPattern(
                    isPropList.map(v =>
                      t.ObjectProperty(
                        t.identifier(v),
                        t.identifier(v),
                        false,
                        true
                      )
                    )
                  ),
                  t.MemberExpression(t.ThisExpression(), t.identifier("props"))
                )
              ])
            );
          }
        }
      });
    },
    StringLiteral(path) {
      if (path.node.value) {
        let v = stringUpdateNames.find(v => v.oldName === path.node.value);
        v && path.replaceWith(t.stringLiteral(v.newName));
      }
    }
  };

  if (Object.keys(mapping.identifierNames).length || isUpdateRequestName) {
    //特殊变量名修改
    vistor.Identifier = function (path) {
      let name = path.node.name;
      if (name === "wx" && !isAddTjApi) {
        // addApiFitImport(result);
        isAddTjApi = true;
      }
      let item = mapping.identifierNames.find(v => v.oldName === name);
      if (item) {
        path.node.name = item.newName;
      } else if (isUpdateRequestName) {
        // item = requestNameList.find(v => v === name)
        // if (t.isTemplateLiteral(path.parent) && path.parent.quasis.find( v => v.value.raw === ))
        // path.node.name = item ? requestNameMap[item] : name
      }
    };
  }

  if (isUpdateRequestName) {
    let hostList = Object.keys(requestPaths);
    let requestList = hostList.map(v => Object.keys(requestPaths[v]));

    vistor.TemplateElement = function (path) {
      let newValue;
      let hostIndex = requestList.findIndex(
        v => (newValue = v.find(v => v === path.node.value.raw))
      );
      let host = hostList[hostIndex];

      newValue = newValue ? requestPaths[host][newValue] : newValue;
      if (newValue) {
        path.replaceWith(
          t.templateElement({
            raw: newValue,
            cooked: newValue
          })
        );
        path.parent.expressions[0].name = host;
      }
    };
    vistor.ObjectPattern = function (path) {
      let properties = path.node.properties;
      if (properties.length) {
        let hostName;
        let isPushPublicHost;
        for (let i = 0; i < properties.length; i++) {
          if (t.isObjectProperty(properties[i]) && properties[i].key) {
            hostName = Object.keys(requestHosts).find(
              v => v === properties[i].key.name
            );
            if (hostName && !isPushPublicHost) {
              isPushPublicHost = true;
              properties.push(
                t.objectProperty(
                  t.identifier(publicRequestHost.hostName),
                  t.identifier(publicRequestHost.hostName),
                  false,
                  true
                )
              );
            }

            // if (delRequestHost.find(v => v === properties[i].key.name)) {
            //     properties.splice(i, 1)
            // }
          } else {
            break;
          }
          // break;
        }

        if (
          !properties.find(
            v => t.isObjectProperty(v) && v.key.name === "PASSPORT_TUJIA_HOST"
          ) &&
          properties.find(
            v => t.isObjectProperty(v) && v.key.name === "WXCUSTOMER_TUJIA_HOST"
          )
        ) {
          properties.push(
            t.objectProperty(
              t.identifier("PASSPORT_TUJIA_HOST"),
              t.identifier("PASSPORT_TUJIA_HOST"),
              false,
              true
            )
          );
        }
      }
    };
  }

  try {
    traverse(result, vistor);
  } catch (e) {
    console.log(filePath, e);
  }

  if (!/searchWidget/.test(filePath)) {
    zfbAddComponentFitToComponentFile(
      result,
      isAddTjApi,
      isComponent,
      isPage,
      isApp,
      isAddTujiaBury,
      filePath
    );
  }


  let code2 = generator(result).code

  if (isNodeModule) {
    let r = babelCore.transform(code2, {
      presets: ["es2015"],
      plugins: ['transform-class-properties']
    })

    code2 = generator(r.ast).code

  }

  return code2
}

async function jsFileTransform(
  mapping,
  newProjectPath,
  filePath,
  toAppType,
  toFilePath
) {
  let fileConent;
  fileConent = await getFileContent(filePath, "utf-8");

  if (toAppType !== "wx" || /vds\-mina\.js/.test(filePath)) {
    fileConent = transform(fileConent, mapping, filePath, toAppType);
  }

  saveFile(toFilePath ? toFilePath : filePath, fileConent);
}

function dataTypeTransform(value) {
  let f;
  switch (value) {
    case "Object":
      f = "{}";
      break;
    case "Array":
      f = "[]";
      break;
    case "Number":
      f = 0;
      break;
    default:
      f = '""';
  }
  return f;
}

function addApiFitImport(ast) {
  let callTjNativeFun = [
    // createImportNode('tjNativeFun', '@tujia/wx_traverse_fit/zfb/api'),
    // t.variableDeclaration('let', [
    //   t.variableDeclarator(t.identifier('tjNativeApi'))
    // ]),
    // t.expressionStatement(
    //   t.assignmentExpression(
    //     '=',
    //     t.identifier('tjNativeApi'),
    //     t.callExpression(
    //       t.identifier('tjNativeFun'),
    //       [t.identifier('my')]
    //     )
    //   )
    // )
    createImportNode(
      [{
        n: "tjNativeApi",
        o: "zfbApi"
      }],
      "wx_traverse_fit"
    )
  ];
  ast.program.body = callTjNativeFun.concat(ast.program.body);
}

function zfbAddComponentFitToComponentFile(
  ast,
  isAddTjApi,
  isComponent,
  isPage,
  isApp,
  isAddTujiaBury,
  filePath
) {
  let keys = [],
    url = "wx_traverse_fit",
    spdsKeys = [],
    spdsKeysUrl = "@tujia/fe_data_bury/js",
    arr = [],
    isNodeModule = /node_modules/.test(filePath)

  if (isComponent) {

    if (isNodeModule) {
      arr.push(
        t.variableDeclaration('var', [t.variableDeclarator(t.identifier('mpAdapt'), t.callExpression(t.identifier('require'), [t.stringLiteral(url)]))]),
        t.variableDeclaration('var', [t.variableDeclarator(t.identifier('zfbCreateNewComponent'), t.memberExpression(t.identifier('mpAdapt'), t.identifier('zfbCreateNewComponent')))])
      )
    } else {
      keys.push({
        o: "zfbCreateNewComponent"
      });
    }

    isAddTujiaBury && spdsKeys.push({
      o: "createNewComponent"
    });
  }
  if (isApp && isAddTujiaBury) {
    spdsKeys.push({
      o: "createNewApp"
    });
  }
  if (isPage && isAddTujiaBury) {
    spdsKeys.push({
      o: "createNewPage"
    });
  }
  if (isAddTjApi) {
    if (isNodeModule) {

      if (isComponent) {
        arr.push(t.variableDeclaration('var', [t.variableDeclarator(t.identifier('tjNativeApi'), t.memberExpression(t.identifier('mpAdapt'), t.identifier('zfbApi')))]))
      } else {
        arr.push(
          t.variableDeclaration('var', [t.variableDeclarator(t.identifier('mpAdapt'), t.callExpression(t.identifier('require'), [t.stringLiteral(url)]))]),
          t.variableDeclaration('var', [t.variableDeclarator(t.identifier('tjNativeApi'), t.memberExpression(t.identifier('mpAdapt'), t.identifier('zfbApi')))])
        )
      }

    } else {
      keys.push({
        n: "tjNativeApi",
        o: "zfbApi"
      });
    }

  }
  // if (!keys.length && !spdsKeys.length) {
  //   return;
  // } else {
  keys.length && arr.push(createImportNode(keys, url));
  spdsKeys.length && arr.push(createImportNode(spdsKeys, spdsKeysUrl));
  // }
  if (isComponent) {
    arr.push(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          t.identifier("Component"),
          t.callExpression(t.identifier("zfbCreateNewComponent"), [
            t.identifier("Component")
          ])
        )
      )
    );
  }
  if (isComponent && spdsKeys.length && isAddTujiaBury) {
    arr.push(
      createNewCircleExpression(
        "component$1",
        "createNewComponent",
        "Component"
      )
    );
    editCircleFunctionName(
      ast.program.body,
      "ExpressionStatement",
      "Component",
      "component$1"
    );
  }
  if (isApp && spdsKeys.length && isAddTujiaBury) {
    arr.push(createNewCircleExpression("app$1", "createNewApp", "App"));
    editCircleFunctionName(
      ast.program.body,
      "ExpressionStatement",
      "App",
      "app$1"
    );
  }
  if (isPage && spdsKeys.length && isAddTujiaBury) {
    arr.push(createNewCircleExpression("page$1", "createNewPage", "Page"));
    editCircleFunctionName(
      ast.program.body,
      "ExpressionStatement",
      "Page",
      "page$1"
    );
  }
  ast.program.body = arr.concat(ast.program.body);
}

function createImportNode(names, path) {
  return typeof names === "string" ?
    t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(names))],
      t.stringLiteral(path)
    ) :
    t.importDeclaration(
      names.map(v =>
        t.importSpecifier(t.identifier(v.n ? v.n : v.o), t.identifier(v.o))
      ),
      t.stringLiteral(path)
    );
}


function createNewCircleExpression(letname, fuc, fucarg) {
  return t.variableDeclaration("let", [
    t.variableDeclarator(
      t.identifier(letname),
      t.callExpression(t.identifier(fuc), [t.identifier(fucarg)])
    )
  ]);
}

function editCircleFunctionName(arr, type, callname, vna) {
  arr.length &&
    arr.forEach(v => {
      if (
        v.type === type &&
        v.expression &&
        v.expression.callee &&
        v.expression.callee.name === callname
      ) {
        v.expression.callee.name = vna;
      }
    });
}

function filterConfigHost(
  code,
  requestHosts,
  publicRequestHost,
  filePath,
  toAppType
) {
  let ast = babylon.parse(code, {
    sourceType: "module",
    plugins: "*"
  });

  traverse(ast, {
    // ObjectProperty(path) {
    //     let name = path.node.key.name
    //     let item = Object.keys(requestHosts).find(v => v === name)
    //     item && path.remove()
    // },
    ObjectExpression(path) {
      path.node.properties.push(
        t.objectProperty(
          t.identifier(publicRequestHost.hostName),
          t.stringLiteral(
            /deploy_t1/.test(filePath) ?
              publicRequestHost["host_url_t1"] :
              /deploy_t2/.test(filePath) ?
                publicRequestHost["host_url_t2"] :
                /deploy_fvt/.test(filePath) ?
                  publicRequestHost["host_url_fvt"] :
                  /deploy_build/.test(filePath) ?
                    publicRequestHost["host_url_build"] :
                    ""
          )
        )
      );
      path.node.properties.unshift(
        t.objectProperty(
          t.identifier("MINIPROGRAM_TYPE"),
          t.stringLiteral(process.env.APP_TYPE)
        )
      );
    }
  });
  return generator(ast).code;
}

function createAppTypeString(binaryExpression) {
  return eval(`'${process.env.APP_TYPE}' ${binaryExpression.operator} '${binaryExpression.right.value}'`)
}
function isAppType(arr, test) {
  if (t.isBinaryExpression(test.left)) {
    arr.push(createAppTypeString(test.left))
    arr.push(test.operator)
    arr.push(createAppTypeString(test.right))
  }
  else if (t.isLogicalExpression(test.left)) {
    isAppType(arr, test.left)
    arr.push(test.operator)
    arr.push(createAppTypeString(test.right))
  }
}
function getAppType(path, node) {
  const test = node.test
  if (node && test) {

    let arr = []
    if (t.isLogicalExpression(test) && t.isBinaryExpression(test.right) && t.isMemberExpression(test.right.left) && test.right.left.property.name === 'APP_TYPE') {
      isAppType(arr, test)
      if (eval(arr.join(' '))) {
        return path.replaceWithMultiple(node.consequent.body)
      }
      else {
        if (node.alternate) {
          getAppType(path, node.alternate)
        }
        else {
          return path.remove()
        }
      }
    }
    else if (t.isBinaryExpression(test) && t.isMemberExpression(test.left) && test.left.property.name === 'APP_TYPE') {
      if (eval(`'${process.env.APP_TYPE}' ${node.test.operator} '${node.test.right.value}'`)) {
        return path.replaceWithMultiple(node.consequent.body)
      }
      else {
        if (node.alternate) {
          getAppType(path, node.alternate)
        }
        else {
          return path.remove()
        }
      }
    }
  }
  else if (t.isBlockStatement(node) && node.body) {
    return path.replaceWithMultiple(node.body)
  }
  else {
    return path.remove()
  }
}

module.exports = jsFileTransform;