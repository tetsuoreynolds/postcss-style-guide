var fs = require('fs')
var postcss = require('postcss')
var ejs = require('ejs')
var nano = require('cssnano')

var mdParse = require('./lib/md_parse')
var highlight = require('./lib/css_highlight')

module.exports = postcss.plugin('postcss-style-guide', function (options) {

    if (typeof(arguments[0]) === 'object') {
        options = arguments[0]
    }

    options = options || {}
    options.theme = options.theme !== undefined ? options.theme : 'default'
    options.name = options.name !== undefined ? options.name : 'Style Guide'
    options.file = options.file !== undefined ? options.file : 'styleguide'
    options.showCode = options.showCode !== undefined ? options.showCode : true

    var themeName = 'psg-theme-' + options.theme
    var themePath
    if (options.theme === 'default') {
        themePath = __dirname + '/node_modules/' + themeName
    }
    else {
        themePath = 'node_modules/' + themeName
    }

    options.template = fs.readFileSync(themePath + '/template.ejs', 'utf-8').trim()
    options.style = fs.readFileSync(themePath + '/style.css', 'utf-8').trim()

    var maps = []
    return function (root) {
        options.processedCSS = options.processedCSS !== undefined ? options.processedCSS : root.toString().trim()

        root.walkComments(function (comment) {
            if (comment.parent.type === 'root') {
                var rule = comment.next()
                var tmp = []
                while (rule !== null && (rule.type === 'rule' || rule.type === 'atrule')) {
                    tmp.push(rule.toString().trim())
                    rule = rule.next() || null
                }

                var tmplRule = tmp.join('\n')
                maps.push({
                    rule: highlight(tmplRule),
                    html: mdParse(comment.text)
                })
            }
        })

        if (arguments[0] !== 'object') {
            processedCSS = root.toString().trim()
        }

        generate(maps, options)

        return root
    }
})

function generate (maps, options) {
    var codeStyle = fs.readFileSync(__dirname + '/node_modules/highlight.js/styles/github.css', 'utf-8').trim()

    Promise.all([
        nano.process(options.processedCSS),
        nano.process(options.style),
        nano.process(codeStyle)
    ]).then(function (result) {

        var params = {
            projectName: options.name,
            processedCSS: result.shift().css,
            tmplStyle: result.shift().css,
            codeStyle: result.shift().css,
            showCode: options.showCode,
            maps: maps
        }

        var html = ejs.render(options.template, params)
        fs.writeFile(options.file + '.html', html, function (err) {
            if (err) {
                throw err
            }
            console.log('Successfully created style guide!')
        })
    })
}
