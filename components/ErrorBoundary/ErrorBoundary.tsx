'use client'

import React, {ErrorInfo} from 'react'
import styles from './ErrorBoundary.module.css'
import PropTypes from 'prop-types'

interface ErrorBoundaryProps {
    assetName: string,
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean,
    error?: Error,
    errorInfo?: ErrorInfo
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
    /** Property validation **/
    static propTypes = {
        assetName: PropTypes.string
    }

    state: ErrorBoundaryState

    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {hasError: false}
    }

    static getDerivedStateFromError(error: Error) {
        return {hasError: true, error}
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({hasError: true, error, errorInfo})
        // console.error(error.message || error, error.stack, errorInfo.componentStack);
    }

    render() {
        const {hasError, error, errorInfo} = this.state
        if (hasError) {
            // You can render any custom fallback UI
            return (
                <div className={styles.container}>
                    {this.props.assetName ? <h2>{this.props.assetName} Rendering Error</h2> : null}
                    <h2 className={styles.message}>{error?.message}</h2>
                    <div className={styles.stack}>{error?.stack}</div>
                    <div className={styles.stack}>{errorInfo?.componentStack}</div>
                </div>
            )
        }

        return this.props.children
    }
}
