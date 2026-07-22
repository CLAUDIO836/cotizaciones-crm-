'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Refresca los Server Components en segundo plano sin recargar la página.
// Pipedrive actualiza MySQL en ~1-2s; con intervalo de 5s el usuario ve el cambio
// en menos de 7 segundos sin tocar nada.
export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
