'use client'
import DIRECTORY from './files.json'
import { FileSearchForm } from '@client'
import { usePathname } from 'next/navigation'

export default function AutoGeneratePage () {
  const currentPath = usePathname()
  return <FileSearchForm directory={DIRECTORY} keywords={currentPath.split('/').filter(p => p)} />
}
