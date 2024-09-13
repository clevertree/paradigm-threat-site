'use client'
import {FileSearchForm} from '@client'
import {usePathname} from 'next/navigation'

export default function AutoGeneratePage() {
    const currentPath = usePathname()
    return <FileSearchForm keywords={currentPath}/>
}
