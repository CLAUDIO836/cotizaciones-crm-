'use client'

import { useState } from 'react'
import { FileSignature, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ApprovalLetterButton({ quotationId }: { quotationId: string }) {
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/approval-letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotation_id: quotationId }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setUrl(data.url)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al generar carta')
    }
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800 font-medium max-w-xs truncate">
          <FileSignature className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate text-xs">{url}</span>
        </div>
        <Button variant="outline" size="sm" onClick={copy} title="Copiar enlace">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" title="Abrir carta">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
        <FileSignature className="w-4 h-4 mr-1.5" />
        {loading ? 'Generando...' : 'Carta de Aprobación'}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
