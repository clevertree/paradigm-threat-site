'use client'
import DIRECTORY from './files.json'
import { FileSearchForm } from '@client'
import { usePathname } from 'next/navigation'

export default function AutoGeneratePage () {
  const currentPath = usePathname()
  return <FileSearchForm fileDirectory={DIRECTORY} keywords={currentPath}/>
}
