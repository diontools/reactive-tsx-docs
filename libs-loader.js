require('colors')
const path = require('path')
const fs = require('fs')

module.exports = function (content, map, meta) {
    const baseDir = path.resolve(__dirname)

    function enumerateFiles(dir, callback) {
        fs.readdirSync(dir).forEach(name => {
            const fullName = path.join(dir, name)
            const stat = fs.statSync(fullName)
            if (!stat.isDirectory()) {
                //console.log('file:', fullName.green)
                callback(fullName)
            } else {
                enumerateFiles(fullName, callback)
            }
        })
    }

    const files = {} // hash: { [fileName]: content }

    function collectFiles(targets) {
        targets.forEach(target => {
            enumerateFiles(target.dir, file => {
                const relativeName = file.substr(baseDir.length + 1).replace(/\\/g, '/')
                if (!target.filter || relativeName.match(target.filter)) {
                    console.log('file:', relativeName.green)

                    const content = fs.readFileSync(file).toString()
                    files[relativeName] = content
                }
            })
        })
    }

    collectFiles([
        { dir: path.join(baseDir, 'node_modules', 'reactive-tsx') },
        { dir: path.join(baseDir, 'node_modules', 'typescript', 'lib'), filter: /lib\.[\w\.]*\.d\.ts$/ },
        { dir: path.join(baseDir, 'node_modules', 'csstype'), filter: /\.d\.ts$/ },
    ])

    return `export default ${JSON.stringify(files)}`
}