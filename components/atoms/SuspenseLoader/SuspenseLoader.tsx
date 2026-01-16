import * as React from "react"

export default function SuspenseLoader() {
    return (
        <div className="flex items-center justify-center p-20 w-full">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )
}

