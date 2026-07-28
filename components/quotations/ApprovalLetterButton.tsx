'use client'

import { useState, useEffect } from 'react'
import { FileSignature, Copy, Check, ExternalLink, Trash2, AlertTriangle, Clock, CheckCircle2, FileDown, Plus, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [letters, setLetters] = useState<Letter[] | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const [deletingToken, setDeletingToken] = useState<string | null>(null)
  const [confirmDeleteToken, setConfirmDeleteToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  async function load() {
    const r = await fetch(`/api/approval-letters/by-quotation?quotation_id=${quotationId}`)
    const d = await r.json()
    setLetters(d.letters ?? [])
  }

  useEffect(() => { load().catch(() => setLetters([])) }, [quotationId])

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
      await load()
      setShowHistory(false) // colapsar historial para ver la nueva versión arriba
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al generar carta')
    }
  }

  async function deleteLetter(token: string) {
    setDeletingToken(token)
    const res = await fetch(`/api/approval-letters/${token}`, { method: 'DELETE' })
    setDeletingToken(null)
    if (res.ok) {
      setConfirmDeleteToken(null)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? `Error al eliminar (HTTP ${res.status})`)
    }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/firmar/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (letters === undefined) {
    return <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-lg" />
  }

  const latest = letters[0] ?? null
  const history = letters.slice(1)

  function LetterRow({ letter, version }: { letter: Letter; version: number }) {
    const isSigned = !!letter.signed_at
    const url = `${window.location.origin}/firmar/${letter.token}`
    const isDeleting = deletingToken === letter.token
    const isConfirming = confirmDeleteToken === letter.token
    const isCopied = copiedToken === letter.token

    return (
      <div className="border rounded-lg p-3 bg-white space-y-2">
        {/* Header fila */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">v{version}</span>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
            style={isSigned
              ? { background: '#dcfce7', color: '#166534' }
              : { background: '#fef9c3', color: '#854d0e' }
            }
          >
            {isSigned
              ? <><CheckCircle2 className="w-3 h-3" /> Firmada</>
              : <><Clock className="w-3 h-3" /> Pendiente firma</>
            }
          </div>
          <span className="text-xs text-gray-400 ml-auto">
            {new Date(letter.created_at).toLocaleDateString('es-CL')}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => copy(letter.token)} title="Copiar link">
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="ml-1">{isCopied ? 'Copiado' : 'Copiar link'}</span>
          </Button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" title="Abrir página firma">
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="ml-1">Abrir</span>
            </Button>
          </a>
          <a href={`/api/approval-letters/${letter.token}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" title="Ver PDF">
              <FileDown className="w-3.5 h-3.5" />
              <span className="ml-1">PDF</span>
            </Button>
          </a>

          {/* Eliminar */}
          {!isConfirming ? (
            <Button
              variant="outline" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:border-red-300 ml-auto"
              onClick={() => setConfirmDeleteToken(letter.token)}
              disabled={isDeleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-red-200 bg-red-50 ml-auto">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-xs text-red-700 font-medium">¿Eliminar?</span>
              <button onClick={() => deleteLetter(letter.token)} disabled={isDeleting}
                className="text-xs font-bold text-red-700 hover:underline ml-1">
                {isDeleting ? '...' : 'Sí'}
              </button>
              <button onClick={() => setConfirmDeleteToken(null)} className="text-xs text-gray-500 hover:underline">No</button>
            </div>
          )}
        </div>

        {/* Info firma */}
        {isSigned && (
          <p className="text-xs text-gray-400">
            Firmada por <strong className="text-gray-600">{letter.signed_name}</strong> · {new Date(letter.signed_at!).toLocaleString('es-CL')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Botón nueva versión — siempre visible */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={generate} disabled={generating}
          style={latest ? { borderColor: '#1B8A4B', color: '#1B8A4B' } : {}}>
          {latest
            ? <><Plus className="w-4 h-4 mr-1.5" />{generating ? 'Generando...' : 'Nueva versión'}</>
            : <><FileSignature className="w-4 h-4 mr-1.5" />{generating ? 'Generando...' : 'Carta de Aprobación'}</>
          }
        </Button>
        {latest && (
          <span className="text-xs text-gray-400">
            {letters.length} {letters.length === 1 ? 'versión' : 'versiones'} · se sube a Pipedrive automáticamente
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* Última versión */}
      {latest && (
        <LetterRow letter={latest} version={letters.length} />
      )}

      {/* Historial versiones anteriores */}
      {history.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
            onClick={() => setShowHistory(v => !v)}
          >
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showHistory ? 'Ocultar' : 'Ver'} versiones anteriores ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map((l, i) => (
                <LetterRow key={l.id} letter={l} version={letters.length - 1 - i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
