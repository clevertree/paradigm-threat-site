'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedirectHandler () {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const isPwa = searchParams.get('pwa') === '1'
    if (!isPwa) return

    const lastReadPath = localStorage.getItem('pt-last-read-path')

    if (lastReadPath) {
      router.replace(lastReadPath)
    } else {
      router.replace('/')
    }
  }, [router, searchParams])

  return null
}

export default function PwaRedirect () {
  return (
    <Suspense fallback={null}>
      <RedirectHandler />
    </Suspense>
  )
}
