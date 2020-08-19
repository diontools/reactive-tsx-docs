import { Component, run, reactive } from 'reactive-tsx'
import * as monaco from 'monaco-editor'
import reactiveTsxTransformer from 'reactive-tsx/lib/transformer'
import * as ts from 'typescript'
import 'normalize.css'
import './style.css'

import libs from '../libs-loader!'

const App: Component = () => {
    let editor1Div: HTMLDivElement
    let editor2Div: HTMLDivElement
    let resultFrame: HTMLIFrameElement

    return <div id="container" onCreate={() => startApp(editor1Div, editor2Div, resultFrame)}>
        <div id="editor1" onCreate={e => editor1Div = e} />
        <div id="right-pane">
            <div id="editor2" onCreate={e => editor2Div = e} />
            <iframe id="result" onCreate={e => resultFrame = e} />
        </div>
    </div>
}

run(document.body, App, {})

function startApp(editor1Div: HTMLDivElement, editor2Div: HTMLDivElement, resultFrame: HTMLIFrameElement) {
    //console.log(libs)

    function getSourceFromUrl() {
        try {
            const obj: unknown = JSON.parse(decodeURIComponent(location.hash.substr(1)))
            if (typeof obj === 'object' && obj !== null && typeof (obj as any).source === 'string') {
                return (obj as any).source as string
            }
        } catch {
        }
    }

    const source = getSourceFromUrl() || `import { Component, run, reactive } from 'reactive-tsx/mono'

const App: Component = () => {
    const count = reactive(0)

    return <div>
        <h1>hello!</h1>
        count: {count.value}
        <button onclick={() => count.value++}>+1</button>
        <button onclick={() => count.value--}>-1</button>
    </div>
}

run(document.body, App, {})
`

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        strict: true,
        target: monaco.languages.typescript.ScriptTarget.ES2015,
        module: monaco.languages.typescript.ModuleKind.ES2015,
        jsx: monaco.languages.typescript.JsxEmit.ReactNative,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    })

    for (const path in libs) {
        if (path.endsWith('.d.ts') && path.indexOf('typescript') < 0) {
            console.log('addExtraLib:', path)
            monaco.languages.typescript.typescriptDefaults.addExtraLib(libs[path]!, path)
        }
    }

    const modelUri1 = monaco.Uri.from({ scheme: 'ts', path: 'index.tsx' })
    const model1 = monaco.editor.createModel(source, 'typescript', modelUri1)

    const modelUri2 = monaco.Uri.from({ scheme: 'js', path: 'index.js' })
    const model2 = monaco.editor.createModel('', 'javascript', modelUri2)

    const codeEditor1 = monaco.editor.create(editor1Div, {
        model: model1,
        automaticLayout: true,
    })

    monaco.editor.create(editor2Div, {
        model: model2,
        automaticLayout: true,
        readOnly: true,
    })


    let transpiledCode = ''

    const sourceFileName = 'index.tsx'
    const transpiledFileName = 'index.js'
    const host: ts.CompilerHost = {
        fileExists(fileName) {
            if (fileName.startsWith('/')) fileName = fileName.substr(1)
            const file = libs[fileName]
            console.log('fileExists', fileName, file !== undefined)
            return file !== undefined
        },
        readFile(fileName) {
            if (fileName.startsWith('/')) fileName = fileName.substr(1)
            const file = libs[fileName]
            console.log('readFile', fileName, file !== undefined)
            return file
        },
        getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
            if (fileName.startsWith('/')) fileName = fileName.substr(1)
            const file = libs[fileName]
            if (file) {
                console.log('getSourceFile', fileName, 'hit')
                return ts.createSourceFile(fileName, file, ts.ScriptTarget.ES2015)
            }

            if (fileName === sourceFileName) {
                console.log('getSourceFile', fileName, 'model1')
                return ts.createSourceFile(fileName, model1.getValue(), ts.ScriptTarget.ES2015)
            }

            console.log('getSourceFile', fileName, 'not found')
        },
        getDefaultLibFileName(options) {
            return 'node_modules/typescript/lib/' + ts.getDefaultLibFileName(options)
        },
        writeFile(fileName, data) {
            console.log('writeFile', fileName)
            if (fileName === transpiledFileName) {
                transpiledCode = data
            }
        },
        getCurrentDirectory() { return '/' },
        getCanonicalFileName(fileName) { return fileName },
        useCaseSensitiveFileNames() { return true },
        getNewLine() { return '\n' },
    }

    const updateResult = () => {
        try {
            const json = JSON.stringify({ source: model1.getValue() })
            location.hash = encodeURIComponent(json)

            const program = ts.createProgram([sourceFileName], {
                strict: true,
                target: ts.ScriptTarget.ES2015,
                module: ts.ModuleKind.ES2015,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                jsx: ts.JsxEmit.ReactNative,
            }, host)

            const sourceFile = program.getSourceFile(sourceFileName)
            if (!sourceFile) throw 'sourceFile is undefined.'
            const emitResult = program.emit(sourceFile, undefined, undefined, undefined, { before: [reactiveTsxTransformer(program, { host })] })
            const message = emitResult.diagnostics.map(d => d.messageText).join('\n')

            model2.setValue(message.length > 0 ? message : transpiledCode)
            resultFrame.contentWindow!.location.reload()
            resultFrame.onload = () => {
                const doc = resultFrame.contentDocument || resultFrame.contentWindow?.document
                if (!doc) throw 'result frame document is undefined.'
                doc.write(`<html><body><script type="text/javascript">(function runner(){${transpiledCode}})()</script></body></html>`)
                doc.close()
            }
        } catch (e) {
            model2.setValue(JSON.stringify(e))
            resultFrame.contentWindow?.location.reload()
        }
    }

    async function init() {
        updateResult()

        let compiling: NodeJS.Timeout | undefined
        function requestUpdate() {
            if (compiling) {
                clearTimeout(compiling)
            }

            compiling = setTimeout(() => {
                compiling = undefined
                updateResult()
            }, 2000)
        }

        function delayUpdate() {
            if (compiling) {
                clearTimeout(compiling)
                requestUpdate()
            }
        }

        codeEditor1.onDidChangeModelContent(requestUpdate)
        codeEditor1.onDidChangeCursorPosition(delayUpdate)
        codeEditor1.onDidChangeCursorSelection(delayUpdate)
    }

    setTimeout(init, 0)
}