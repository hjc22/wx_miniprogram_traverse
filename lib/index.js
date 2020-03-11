const jsFileTransform = require('./jsFileTransform')
const jsonFileTransform = require('./jsonFileTransform')
const wxmlFileTransform = require('./wxmlFileTransform')
const {wxssFileTransform,wxssCodeTransform} = require('./wxssFileTransform')
const wxsFileTransform = require('./wxsFileTransform')



module.exports = {
    jsFileTransform,
    jsonFileTransform,
    wxmlFileTransform,
    wxssFileTransform,
    wxssCodeTransform,
    wxsFileTransform
}