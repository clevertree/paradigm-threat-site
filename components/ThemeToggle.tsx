'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark')

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
        if (savedTheme) {
            setTheme(savedTheme)
            document.documentElement.classList.toggle('dark', savedTheme === 'dark')
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark')
            document.documentElement.classList.add('dark')
        }
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
    }

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
    )
}
