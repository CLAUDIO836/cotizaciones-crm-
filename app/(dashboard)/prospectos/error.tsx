'use client'
import { useEffect } from 'react'

export default function ProspectosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Prospectos Error]', error)
  }, [error])

  return (
    <div className="p-8 max-w-lg mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Error al cargar Prospectos</h2>
      <p className="text-sm text-gray-600 mb-4">
        {error.message || 'Ocurrió un error inesperado'}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 mb-4">Código: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
      >
        Intentar de nuevo
      </button>
    </div>
  )
}
