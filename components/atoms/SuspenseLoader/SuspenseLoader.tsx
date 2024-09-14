import styles from './SuspenseLoader.module.scss';
import * as React from "react"

export default function SuspenseLoader() {
    return (
        <div className={styles.container}>
            <div
                className={styles.loader}
            />
        </div>
    )
}

