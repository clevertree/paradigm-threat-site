"use client"

import React, {useEffect, useRef, useState} from "react";
import styles from "./FileSearchForm.module.css"

const FETCH_URL = '/api/fs/search/'

let timeout = null;
export default function FileSearchForm({keywords}) {
    const [keywordsList, setKeywordsList] = useState(keywords);
    const [fileList, setFileList] = useState([]);
    const [assetList, setAssetList] = useState([]);
    const [loading, setLoading] = useState(true);
    const refForm = useRef();

    useEffect(() => {
        if (keywordsList) {
            fetch(`${FETCH_URL}/${keywordsList}`)
                .then(res => res.json())
                .then(response => {
                    setFileList(response.results);
                    setLoading(false)
                });
        }
    }, [keywordsList]);

    return <form onSubmit={onSubmit} className={styles.form}
                 ref={refForm}>
        <fieldset className="asset-search">
            <label>Search: </label>
            <input name="search"
                   onFocus={onFocus}
                   onChange={onChange}
                   defaultValue={keywordsList}/>
            <button type="submit">Search</button>
        </fieldset>
        <article className={"search asset-spread"}>
            {!loading ? <ul>
                <h2>Markdown Search Results:</h2>
                {fileList.map((file, key) => <li key={key}>
                    <a href={file}>{file}</a>
                </li>)}
            </ul> : null}
        </article>
    </form>;

    function onChange() {
        clearTimeout(timeout);
        timeout = setTimeout(onSubmit, 250)
    }

    function onSubmit(e = null) {
        e && e.preventDefault();
        const {value} = refForm.current.elements.search;
        setKeywordsList(value)
    }


    function onFocus(e) {
        e.target.setSelectionRange(0, e.target.value.length)
    }

}