'use client'

import { useState, useEffect } from 'react'
import { FileSignature, Copy, Check, ExternalLink, Trash2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Letter {
  id: string
  token: string
  signed_at: string | null
  signed_name: string | null
  sent_at: string | null
  created_at: string
  client_name: string
}

export default function ApprovalLetterButton({ quotationId }: { quotationId: string }) {
  const [letter, setLetter] = useState<Letter | null | undefined>(undefined) // undefined = loading
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    fetch(`/api/approval-letters/by-quotation?quotation_id=${quotationId}`)
      .then(r => r.json())
      .then(d => setLetter(d.letter ?? null))
      .catch(() => setLetter(null))
  }, [quotationId])

  const url = letter ? `${window.location.origin}/firmar/${letter.token}` : ''

  async function generate() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/approval-letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotation_id: quotationId }),
    })
    setGenerating(false)
    if (res.ok) {
      const data = await res.json()
      // Refetch to get full letter data
      const r = await fetch(`/api/approval-letters/by-quotation?quotation_id=${quotationId}`)
      const d = await r.json()
      setLetter(d.letter ?? null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al generar carta')
    }
  }

  async function deleteLetter() {
    if (!letter) return
    setDeleting(true)
    const res = await fetch(`/api/approval-letters/${letter.token}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setLetter(null)
      setShowConfirmDelete(false)
    } else {
      setError('Error al eliminar')
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading
  if (letter === undefined) {
    return <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-lg" />
  }

  // No hay carta — mostrar botón crear
  if (!letter) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
          <FileSignature className="w-4 h-4 mr-1.5" />
          {generating ? 'Generando...' : 'Carta de Aprobación'}
        </Button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  // Hay carta — mostrar estado
  const isSigned = !!letter.signed_at

  return (
    <div className="flex flex-col gap-1.5">
      {/* Fila principal */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Badge estado */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
          style={isSigned
            ? { background: '#dcfce7', color: '#166534' }
            : { background: '#fef9c3', color: '#854d0e' }
          }
        >
          {isSigned
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Firmada</>
            : <><Clock className="w-3.5 h-3.5" /> Pendiente firma</>
          }
        </div>

        {/* Acciones */}
        <Button variant="outline" size="sm" onClick={copy} title="Copiar link">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" title="Abrir carta">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>

        {/* Eliminar */}
        {!showConfirmDelete ? (
          <Button
            variant="outline" size="sm"
            onClick={() => setShowConfirmDelete(true)}
            title="Eliminar carta"
            disabled={deleting}
            className="text-red-500 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-700 font-medium">¿Eliminar?</span>
            <button onClick={deleteLetter} disabled={deleting}
              className="text-xs font-bold text-red-700 hover:underline ml-1">
              {deleting ? '...' : 'Sí'}
            </button>
            <button onClick={() => setShowConfirmDelete(false)}
              className="text-xs text-gray-500 hover:underline">
              No
            </button>
          </div>
        )}
      </div>

      {/* Info firma */}
      {isSigned && (
        <p className="text-xs text-gray-400 ml-0.5">
          Firmada por <strong className="text-gray-600">{letter.signed_name}</strong> · {new Date(letter.signed_at!).toLocaleString('es-CL')}
        </p>
      )}
      {!isSigned && (
        <p className="text-xs text-gray-400 ml-0.5">
          Creada {new Date(letter.created_at).toLocaleString('es-CL')} · esperando firma del cliente
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
