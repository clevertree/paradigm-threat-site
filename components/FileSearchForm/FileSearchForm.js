'use client'

import React, { useEffect, useRef, useState } from 'react'
import styles from './FileSearchForm.module.scss'
import { PopImage, EmbedFile } from '@client'

const FETCH_URL = '/api/fs/search/'

let timeout = null
export default function FileSearchForm ({ keywords }) {
  const [keywordsList, setKeywordsList] = useState(keywords)
  const [{ pages, files }, setSearchResults] = useState({ pages: [], files: [] })
  const [loading, setLoading] = useState(true)
  const refForm = useRef()

  useEffect(() => {
    if (keywordsList) {
      setLoading(true)
      fetch(`${FETCH_URL}${keywordsList}`)
        .then(res => res.json())
        .then(response => {
          setSearchResults(response)
          setLoading(false)
        })
    }
  }, [keywordsList])

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
                <h2>Markdown Search Results:</h2>

                {pages.length > 0
                  ? (
                    <ul>
                      <div className={styles.pageContainer}>
                        {pages.map(({ path, lines }) => (
                          <li key={path}>
                            <a href={path}>{path}</a>
                            <p>{lines.join('\n')}</p>
                          </li>
                        ))}
                      </div>
                    </ul>
                    )
                  : <h3>No pages found</h3>}

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

  function onChange () {
    clearTimeout(timeout)
    timeout = setTimeout(onSubmit, 250)
  }

  function onSubmit (e = null) {
    if (e !== null) e.preventDefault()
    const { value } = refForm.current.elements.search
    window.history.pushState({}, '', value)

    setKeywordsList(value)
  }

  function onFocus (e) {
    e.target.setSelectionRange(0, e.target.value.length)
  }

  function renderAsset (filePath) {
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
            src={'/' + filePath}
            width={256}
            height={256}
            alt={filePath}
          >
            <a href={filePath} target='_blank' rel='noopener noreferrer'>{filePath}</a>
          </PopImage>
        )
      case 'pdf':
        return (
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
            <embed src={filePath} className='w-full min-h-[40vh] min-w-[20vw]' />
            <a href={filePath} target='_blank' rel='noopener noreferrer'>{filePath}</a>
          </div>
        )
    }
  }
}
