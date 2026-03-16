'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FileDown, ChevronDown } from 'lucide-react'

const DOC_LINKS = [
  { label: 'Book (Google Docs)', href: 'https://docs.google.com/document/d/1nLm73Z-xCyQKOkNLQwH3hFia6H4Me3FW' },
  { label: 'Appendix (Google Docs)', href: 'https://docs.google.com/document/d/1vyxQlF7xjQtKX6xLyxpZWZzdJv6X-3tx' },
] as const

interface DocDownloadMenuProps {
  baseUrl: string
  className?: string
  /** 'compact' = smaller padding (py-2 px-2.5), default = py-1.5 */
  buttonVariant?: 'compact' | 'default'
}

export function DocDownloadMenu({ baseUrl, className, buttonVariant = 'default' }: DocDownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const links = [
    { label: 'Book PDF', href: `${baseUrl}/export/timeline-book.pdf` },
    { label: 'Appendix PDF', href: `${baseUrl}/export/timeline-appendix.pdf` },
    ...DOC_LINKS,
  ]

  const buttonClass =
    buttonVariant === 'compact'
      ? 'shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1'
      : 'shrink-0 rounded border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1'

  return (
    <div className={className ?? 'relative'} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClass}
        title="Download documents"
      >
        <FileDown size={14} /> <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
