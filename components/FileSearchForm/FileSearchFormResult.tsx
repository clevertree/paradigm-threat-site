import React, {useEffect, useState} from "react";
import styles from './FileSearchFormResult.module.scss'
import LoadingScreen from "@/app/site/loading";
import {PopImage} from "@client";

const MAX_RESULT_LENGTH = 1024;

interface FileSearchFormResultProps {
    url: string,
    keywordList: string[]
}

interface FileSearchFormResultURL {
    src: string,
    alt: string
}

let PreviewDocument: Document;
let PreviewHTMLElement: HTMLElement;
export const FileSearchFormResult = ({url, keywordList}: FileSearchFormResultProps) => {
    const [error, setError] = useState<string | null>()
    const [loading, setLoading] = useState(true)
    const [resultTitle, setResultTitle] = useState('')
    const [textContent, setTextContent] = useState<string>('')
    const [imageURLs, setImageURLs] = useState<Array<FileSearchFormResultURL>>([])

    useEffect(() => {
        if (url) {
            (async () => {
                setError(null)
                setLoading(true)
                try {
                    if (!PreviewDocument) {
                        PreviewDocument = document.implementation.createHTMLDocument('preview');
                        PreviewHTMLElement = PreviewDocument.createElement('html');
                    }
                    const res = await fetch(url);
                    PreviewHTMLElement.innerHTML = await res.text();

                    const title = PreviewHTMLElement.getElementsByTagName('title')[0].text;
                    setResultTitle(title);
                    const regexKeywordList = new RegExp(keywordList.join("|"), "gi")
                    const textElms = PreviewHTMLElement.querySelectorAll('p');
                    for (let i = 0; i < textElms.length; i++) {
                        const textElm = textElms[i];
                        if (textElm.textContent && regexKeywordList.test(textElm.textContent)) {
                            let textContent = textElm.innerHTML;
                            if (textContent.length > MAX_RESULT_LENGTH)
                                textContent = textContent.substring(0, MAX_RESULT_LENGTH) + '...'
                            setTextContent(textContent);
                            break;
                        }
                    }

                    const imageElms = PreviewHTMLElement.querySelectorAll('img');
                    const resultURLs: Array<FileSearchFormResultURL> = [];
                    for (let i = 0; i < imageElms.length; i++) {
                        const imageElm = imageElms[i];
                        if (regexKeywordList.test(imageElm.src)
                            || regexKeywordList.test(imageElm.alt)) {
                            resultURLs.push({src: imageElm.src, alt: imageElm.alt})
                        }
                    }
                    setImageURLs(resultURLs)
                    setLoading(false)

                } catch (error) {
                    if (error instanceof Error) {
                        console.error(error)
                        setError(error.message)
                        setLoading(false)
                    }
                }
            })()
        }
    }, [keywordList, url])


    return <div className={styles.result}>
        <div className={styles.title}>
            {loading && <LoadingScreen/>}
            <a href={url + '?searchKeyword=' + keywordList}>{resultTitle ? `${url} (${resultTitle})` : url}</a>
            {error &&
              <div className={styles.error}>Could not query result: {error}</div>}
        </div>
        <div className={styles.summary} dangerouslySetInnerHTML={{
            __html: textContent
        }}/>
        {imageURLs.length > 0 ? <div className={styles.images}>
            {imageURLs.map(({src, alt}) => <PopImage
                key={src}
                src={src}
                alt={alt}
            />)}
        </div> : null}
    </div>
}
