'use client'

import { useEffect, useRef } from 'react'

// Polling liviano: cada 5 segundos consulta el hash de estado del listado.
// Si el servidor devuelve un hash distinto al anterior, recarga la página.
// Así el usuario nunca tiene que recargar manualmente.
export default function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
  const lastHash = useRef<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/quotations/hash', { cache: 'no-store' })
        if (!res.ok) return
        const { hash } = await res.json()
        if (lastHash.current === null) {
          lastHash.current = hash
          return
        }
        if (hash !== lastHash.current) {
          lastHash.current = hash
          window.location.reload()
        }
      } catch {
        // silencioso — no interrumpir al usuario si falla la red
      }
    }

    const id = setInterval(check, intervalMs)
    // No ejecutar inmediatamente al montar — solo detectar cambios futuros
    return () => clearInterval(id)
  }, [intervalMs])

  return null
}
