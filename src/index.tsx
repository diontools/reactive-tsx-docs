import { Component, run, reactive, version } from 'reactive-tsx'
import * as pako from 'pako'
import * as monaco from 'monaco-editor'
import reactiveTsxTransformer from 'reactive-tsx/lib/transformer'
import removeExportTransformer from 'reactive-tsx/lib/transformer-remove-export'
import * as ts from 'typescript'
import 'normalize.css'
import './style.css'

import libs from '../libs-loader!'

const resultSourceDoc = reactive('')

const App: Component = () => {
    let editor1Div: HTMLDivElement
    let editor2Div: HTMLDivElement

    return <div id="container" onCreate={() => startApp(editor1Div, editor2Div)}>
        <header>
            <div class="logo">&lt;R</div>
            <div class="title">reactive-tsx Playground</div>
            <a class="button" href="https://github.com/diontools/reactive-tsx" target="_blank">GitHub</a>
            <span class="version">v{version}</span>
            <span class="version">TypeScript v{ts.version}</span>
        </header>
        <main>
            <div id="editor1" onCreate={e => editor1Div = e} />
            <div id="right-pane">
                <div id="editor2" onCreate={e => editor2Div = e} />
                <div id="result-pane">
                    <a id="result-tool" class="button" href={'data:text/html,' + encodeURIComponent(resultSourceDoc.value)} target="_blank">open</a>
                    <iframe id="result" sandbox="allow-scripts" srcDoc={resultSourceDoc.value} />
                </div>
            </div>
        </main>
    </div>
}

run(document.body, App, {})

function startApp(editor1Div: HTMLDivElement, editor2Div: HTMLDivElement) {
    //console.log(libs)

    const textDecoder = new TextDecoder()
    const textEncoder = new TextEncoder()
    let currentHash: string | undefined

    function getSourceFromUrl() {
        try {
            let base64String =
                location.hash.substr(1)
                    .replace(/-/g, '+').replace(/_/g, '/')
            switch (base64String.length % 4) {
                case 2: base64String += '=='; break
                case 3: base64String += '='; break
            }
            const compressedString = atob(base64String)
            const compressedBytes = new Uint8Array(compressedString.length)
            for (let i = 0; i < compressedBytes.length; i++) compressedBytes[i] = compressedString.charCodeAt(i)
            const jsonBytes = pako.inflateRaw(compressedBytes)
            const json = textDecoder.decode(jsonBytes)
            const obj: unknown = JSON.parse(json)
            if (typeof obj === 'object' && obj !== null && typeof (obj as any).source === 'string') {
                return (obj as any).source as string
            }
        } catch {
        }
    }

    function setSourceToUrl(source: string) {
        const json = JSON.stringify({ source })
        const jsonBytes = textEncoder.encode(json)
        const base64UrlString =
            btoa(String.fromCharCode.apply(null, pako.deflateRaw(jsonBytes) as any))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/m, '')
        currentHash = base64UrlString
        location.hash = base64UrlString
    }

    window.addEventListener('hashchange', ev => {
        ev.preventDefault()
        console.log('hash changed', location.hash)
        const hash = location.hash.substr(1)
        if (currentHash !== hash) {
            currentHash = hash
            const source = getSourceFromUrl()
            if (source) model1.setValue(source)
        }
    })

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
        if (path.indexOf('typescript') < 0) {
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
            setSourceToUrl(model1.getValue())

            const program = ts.createProgram([sourceFileName], {
                strict: true,
                target: ts.ScriptTarget.ES2015,
                module: ts.ModuleKind.ES2015,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                jsx: ts.JsxEmit.ReactNative,
            }, host)

            const sourceFile = program.getSourceFile(sourceFileName)
            if (!sourceFile) throw 'sourceFile is undefined.'
            const emitResult = program.emit(sourceFile, undefined, undefined, undefined, { before: [reactiveTsxTransformer(program, { host })], after: [removeExportTransformer(program)] })
            const message = emitResult.diagnostics.map(d => d.messageText).join('\n')

            model2.setValue(message.length > 0 ? message : transpiledCode)
            resultSourceDoc.value = `<!DOCTYPE html><html><body><script type="text/javascript">(function runner(){${transpiledCode}})()</script></body></html>`
        } catch (e) {
            model2.setValue(JSON.stringify(e))
            resultSourceDoc.value = ''
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