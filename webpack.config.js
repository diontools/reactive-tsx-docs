const webpack = require('webpack')
const path = require('path')
const ReactiveTsxTransformer = require('reactive-tsx/lib/transformer').default
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

console.log('webpack!')

const config = {
    entry: './src/index.tsx',
    output: {
        path: path.resolve(__dirname, 'docs'),
        filename: 'bundle.js?[hash]'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    getCustomTransformers: program => ({
                        before: [ReactiveTsxTransformer(program)]
                    })
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.ttf$/,
                loader: 'file-loader',
            },
            {
                test: /\.libs-loader$/,
                loader: path.resolve(__dirname, 'libs-loader'),
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.libs-loader']
    },
    plugins: [
        new MonacoWebpackPlugin({
            languages: ['typescript', 'javascript'],
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './src/index.html')
        })
    ]
}

module.exports = config
