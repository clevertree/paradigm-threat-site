'use client'

import React, {FocusEvent, useEffect, useRef, useState} from 'react'
import styles from './FileSearchForm.module.scss'
import {FileSearchFormResult} from "@/components/FileSearchForm/FileSearchFormResult";

interface FileSearchFormProps {
    keywords?: string,
}

const API_URL = process.env.NEXT_PUBLIC_API
let timeout: number = -1
export default function FileSearchForm({keywords = ""}: FileSearchFormProps) {
    const [keywordString, setKeywordString] = useState<string>(processKeywordList(keywords).join(','))
    const [error, setError] = useState<string | null>()
    const [loading, setLoading] = useState(true)
    const [searchResults, setSearchResults] = useState([])
    const refForm = useRef<HTMLFormElement>(null)
    useEffect(() => {
        if (keywordString) {
            const keywordList = processKeywordList(keywordString)
            setError(null)
            setLoading(true)
            fetch(`${API_URL}/api/search/${keywordList.join('/')}`)
                .then(res => res.json())
                .then((searchContent) => {
                    if (searchContent.error) {
                        setError(JSON.stringify(searchContent.error))
                    } else {
                        setSearchResults(searchContent)
                    }
                }).catch(error => {
                console.error(error)
                setError(error.message)
            })

            setLoading(false)
        }
    }, [keywordString])

    return (
        <div className={styles.container}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    onSubmit();
                }} className={styles.form}
                ref={refForm}
            >
                <fieldset className='asset-search'>
                    <input
                        name='search'
                        onFocus={onFocus}
                        onChange={onChange}
                        defaultValue={keywordString}
                    />
                    <button type='submit'>Search</button>
                </fieldset>
                {error &&
                  <div className={styles.error}>Could not perform search: {error}</div>}
            </form>
            <div className={styles.results}>
                {!keywordString
                    ? <h2>Enter keywords to search...</h2>
                    : (loading
                            ? <h2>Searching assets...</h2>
                            : (
                                <>
                                    <h2>Search Results:</h2>
                                    <div>
                                        {searchResults.map(result => renderSearchResult(result))}
                                    </div>
                                </>
                            )
                    )}
            </div>
        </div>
    )

    function onChange() {
        window.clearTimeout(timeout)
        timeout = window.setTimeout(onSubmit, 250)
    }

    function onSubmit() {
        if (refForm.current) {
            // @ts-ignore TODO: find a typescript solution
            const {value} = refForm.current.elements?.search
            window.history.pushState({}, '', value)

            setKeywordString(value)
        }
    }

    function onFocus(e: FocusEvent) {
        // @ts-ignore TODO: resolve typescript issue
        e.target.setSelectionRange(0, e.target.value.length)
    }

    function renderSearchResult(filePath: string) {
        return <div key={filePath}>
            <FileSearchFormResult keywordList={processKeywordList(keywordString)} url={filePath}/>
        </div>
    }
}

function processKeywordList(keywordString: string) {
    return (keywordString || '').split(/[;, /]+/g)
        .map(s => s.replace(/[^a-zA-Z]+/g, ''))
        .filter(i => !!i)
}

