'use client'

import React, { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Search, Home, MessageSquare, Video } from 'lucide-react'
import { ThemeToggle, DynamicNav } from '@/components'

interface NavbarProps {
    fileList: any
}

const Navbar = memo(function Navbar({ fileList }: NavbarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()

    // Close menu when path changes
    useEffect(() => {
        setIsOpen(false)
    }, [pathname])

    const navLinks = [
        { href: '/search', label: 'Search', icon: Search },
        { href: '/', label: 'Home', icon: Home },
        { href: '/chat', label: 'Chat', icon: MessageSquare },
        { href: 'https://www.bitchute.com/channel/paradigmthreat', label: 'Videos', icon: Video, external: true },
    ]

    return (
        <header className="w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none sticky top-0 z-[100] backdrop-blur-md bg-opacity-80 dark:bg-opacity-80">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16 md:h-20">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
                            <img src="/site/header.png" alt="Header Logo" className="h-10 md:h-14 w-auto" />
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    target={link.external ? '_blank' : undefined}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${pathname === link.href
                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <link.icon size={18} />
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Dropdown */}
            {isOpen && (
                <div className="lg:hidden absolute top-full left-0 right-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl animate-in slide-in-from-top-4 duration-200 max-h-[80vh] overflow-y-auto">
                    <nav className="flex flex-col p-4 gap-4">
                        <div className="flex flex-col gap-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    target={link.external ? '_blank' : undefined}
                                    className={`px-4 py-3 rounded-xl text-base font-medium flex items-center gap-3 transition-colors ${pathname === link.href
                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <link.icon size={20} />
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                            <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Directory
                            </div>
                            <DynamicNav directory={fileList} className="flex flex-col" />
                        </div>
                    </nav>
                </div>
            )}
        </header>
    )
})

export default Navbar;
