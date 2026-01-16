'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function AutoGeneratePage() {
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // Redirect to the new search page with the path as query
        const query = pathname.split('/').pop() || ''
        if (query) {
            router.replace(`/search?q=${encodeURIComponent(query)}`)
        }
    }, [pathname, router])

    return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="text-2xl font-bold text-slate-400">Searching the repository...</div>
        </div>
    )
}
