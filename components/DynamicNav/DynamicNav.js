'use client'

import React from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DynamicNav ({ directory, children, className }) {
  const currentPath = usePathname()

  function renderDirectory (directory, currentPath, children = null) {
    return (
      <div key={currentPath} className={className}>
        {children}
        {Object.keys(directory).map(subPathName => {
          const relativeSubPathName = currentPath + subPathName
          return (
            <Link
              key={subPathName}
              className={relativeSubPathName === currentPath ? 'current' : ''}
              href={relativeSubPathName}
            >{subPathName.split('/').pop()}
            </Link>

          )
        })}
      </div>
    )
  }

  if (!directory) { return null }

  const content = [
    renderDirectory(directory, '/', children)
  ]
  if (currentPath) {
    const splitPath = currentPath.split('/')
    let directoryPointer = directory
    let iSubPath = '/'
    for (const subPath of splitPath) {
      if (directoryPointer[subPath] &&
        Object.keys(directoryPointer[subPath]).length > 0) {
        directoryPointer = directoryPointer[subPath]
        iSubPath += subPath + '/'
        content.push(renderDirectory(directoryPointer, iSubPath))
      }
    }
  }
  return content
}
