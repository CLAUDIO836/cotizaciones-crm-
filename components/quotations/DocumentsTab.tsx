'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, ExternalLink } from 'lucide-react'

interface PdfVersion {
  id: number
  quotation_id: string
  version: number
  created_at: string
  created_by: string | null
  created_by_name: string | null
  motivo: string | null
  pipedrive_file_id: string | null
  pdf_hash: string | null
  pdf_size_bytes: number | null
}

function formatDateTime(dt: string) {
  const d = new Date(dt)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function formatBytes(n: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentsTab({ quotationId }: { quotationId: string }) {
  const [versions, setVersions] = useState<PdfVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cotizaciones/${quotationId}/pdfs`)
      .then(r => r.json())
      .then(j => setVersions(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [quotationId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        Cargando historial...
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
        <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Sin documentos todavía</p>
        <p className="text-sm mt-1">Cada vez que generes un PDF quedará registrado aquí.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Historial de PDFs — {versions.length} {versions.length === 1 ? 'versión' : 'versiones'}
      </h2>

      {versions.map(v => (
        <div key={v.id} className="bg-white rounded-xl border p-4 flex items-start gap-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: v.version === 1 ? '#6366f1' : '#1B8A4B' }}
          >
            v{v.version}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">
                Versión {v.version}
                {v.version === versions[versions.length - 1].version
                  ? <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">inicial</span>
                  : null}
              </span>
              {v.pipedrive_file_id && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  En Pipedrive
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(v.created_at)}
              {v.created_by_name && ` · por ${v.created_by_name}`}
              {v.pdf_size_bytes ? ` · ${formatBytes(v.pdf_size_bytes)}` : ''}
            </p>

            {v.motivo && (
              <p className="text-sm text-gray-600 mt-1 italic">"{v.motivo}"</p>
            )}

            {v.pdf_hash && (
              <p className="text-xs text-gray-300 font-mono mt-1 truncate" title={v.pdf_hash}>
                SHA256: {v.pdf_hash.slice(0, 16)}…
              </p>
            )}
          </div>

          {v.pipedrive_file_id && (
            <div className="flex gap-2 flex-shrink-0">
              <a
                href={`/api/pipedrive/file/${v.pipedrive_file_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                title="Ver PDF"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver
              </a>
              <a
                href={`/api/pipedrive/file/${v.pipedrive_file_id}`}
                download
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                title="Descargar PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
