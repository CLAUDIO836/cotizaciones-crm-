'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const POLL_INTERVAL = 2 * 60 * 1000 // 2 minutos

export default function UpdateBanner({ currentBuildId }: { currentBuildId: string }) {
  const [outdated, setOutdated] = useState(false)
  const initialId = useRef(currentBuildId)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        const { buildId } = await r.json()
        if (buildId && buildId !== initialId.current && buildId !== 'local') {
          setOutdated(true)
        }
      } catch {
        // silencioso si falla la red
      }
    }

    const interval = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  if (!outdated) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium"
      style={{ background: '#1B8A4B', color: '#fff' }}
    >
      <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Nueva versión disponible</span>
      <button
        onClick={() => window.location.reload()}
        className="px-2.5 py-0.5 rounded-md text-xs font-semibold border border-white/40 hover:bg-white/20 transition-colors"
      >
        Actualizar ahora
      </button>
    </div>
  )
}
