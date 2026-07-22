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
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium"
      style={{ background: '#1e293b', color: '#f8fafc', minWidth: 320 }}
    >
      <RefreshCw className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
      <span>Hay una nueva versión del CRM disponible.</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-auto px-3 py-1 rounded-lg text-xs font-bold"
        style={{ background: '#22c55e', color: '#fff' }}
      >
        Actualizar
      </button>
    </div>
  )
}
