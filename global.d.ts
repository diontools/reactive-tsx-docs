declare module 'raw-loader!*' {
    const contents: string
    export default contents
}

declare module '*libs-loader!' {

    interface Files {
        [path: string]: string | undefined;
    }

    const files: Files
    export default files
}