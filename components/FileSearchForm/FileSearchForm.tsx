'use client'

import React, {FocusEvent, FormEvent, FormEventHandler, useEffect, useRef, useState} from 'react'
import styles from './FileSearchForm.module.scss'
import {PopImage, EmbedFile} from '@client'

interface FileSearchFormProps {
    keywords: string,
    fileDirectory: FileDirectoryObject
}

interface FileDirectoryObject {
    [key: string]: Array<string>
}

let timeout: number = -1
export default function FileSearchForm({keywords, fileDirectory}: FileSearchFormProps) {
    const [keywordsList, setKeywordsList] = useState(processKeywordList(keywords))
    const [files, setSearchResults] = useState<Array<string>>([])
    const [loading, setLoading] = useState(true)
    const refForm = useRef<HTMLFormElement>(null)
    useEffect(() => {
        if (keywordsList) {
            setLoading(true)
            const keywordRegexList = keywordsList.map(k => new RegExp(k, 'i'))
            const files: Array<string> = []
            for (const path of Object.keys(fileDirectory)) {
                const pathFiles = fileDirectory[path]
                for (const fileName of pathFiles) {
                    const filePath = path + '/' + fileName
                    if (keywordRegexList.every(regex => regex.test(path) || regex.test(fileName))) {
                        files.push(filePath)
                    }
                }
            }
            setSearchResults(files)
            setLoading(false)
        }
    }, [fileDirectory, keywordsList])

    return (
        <>
            <form
                onSubmit={onSubmit} className={styles.form}
                ref={refForm}
            >
                <fieldset className='asset-search'>
                    <input
                        name='search'
                        onFocus={onFocus}
                        onChange={onChange}
                        defaultValue={keywordsList}
                    />
                    <button type='submit'>Search</button>
                </fieldset>

            </form>
            {!keywordsList
                ? <h2>Enter keywords to search...</h2>
                : (loading
                        ? <h2>Searching assets...</h2>
                        : (
                            <>
                                {/* <h2>Markdown Search Results:</h2> */}

                                {/* {pages.length > 0 */}
                                {/*  ? ( */}
                                {/*    <ul> */}
                                {/*      <div className={styles.pageContainer}> */}
                                {/*        {pages.map(({ path, lines }) => ( */}
                                {/*          <li key={path}> */}
                                {/*            <a href={path}>{path}</a> */}
                                {/*            <p>{lines.join('\n')}</p> */}
                                {/*          </li> */}
                                {/*        ))} */}
                                {/*      </div> */}
                                {/*    </ul> */}
                                {/*    ) */}
                                {/*  : <h3>No pages found</h3>} */}

                                <h2>Asset Search Results:</h2>

                                {files.length > 0
                                    ? (
                                        <div className={styles.assetContainer}>
                                            {files.map((filePath) => renderAsset(filePath))}
                                        </div>
                                    )
                                    : <h3>No assets found</h3>}
                            </>
                        )
                )}
        </>
    )

    function onChange() {
        clearTimeout(timeout)
        timeout = setTimeout(onSubmit, 250)
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault()
        if (refForm.current) {
            // @ts-ignore TODO: find a typescript solution
            const {value} = refForm.current.elements?.search
            window.history.pushState({}, '', value)

            setKeywordsList(processKeywordList(value))
        }
    }

    function onFocus(e: FocusEvent) {
        // @ts-ignore TODO: resolve typescript issue
        e.target.setSelectionRange(0, e.target.value.length)
    }

    function renderAsset(filePath: string) {
        const ext = filePath.toLowerCase().split('.').pop()
        switch (ext) {
            case 'css':
            case 'js':
            case 'ts':
            case 'md':
            case 'mdx':
                break
            case 'img':
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'svg':
            case 'ppm':
                return (
                    <PopImage
                        key={filePath}
                        src={filePath}
                        width={256}
                        height={256}
                        alt={filePath}
                    >
                        <a href={filePath} target='_blank' rel='noopener noreferrer'>{filePath}</a>
                    </PopImage>
                )
            case 'pdf':
                return (
                    // @ts-ignore TODO: resolve typescript issue
                    <EmbedFile
                        key={filePath}
                        src={filePath}
                    />
                )
            case 'm4v':
            case 'mp4':
            case 'mkv':
            case 'json':
            case 'txt':
            default:
                return (
                    <div
                        key={filePath}
                    >
                        <embed src={filePath} className='w-full min-h-[40vh] min-w-[20vw]'/>
                        <a href={filePath} target='_blank' rel='noopener noreferrer'>{filePath}</a>
                    </div>
                )
        }
    }
}

function processKeywordList(keywordString: string) {
    return (keywordString || '').split(/[;, /]+/g).filter(i => !!i)
}
