'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, Clock, ExternalLink, History, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface HistoryItem {
  id: string
  number?: string
  pipedrive_deal_id?: string
  status: 'open' | 'won' | 'lost'
  pipeline_name?: string
  total: number
  fecha_salida?: string
  issue_date?: string
  created_at?: string
  vendedor_name?: string
}

interface Props {
  clientId: string
  clientName: string
  clientRut?: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
}

export default function ClientHistoryPopover({
  clientId, clientName, clientRut, clientEmail, clientPhone, clientAddress,
}: Props) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (!history && !loading) {
      setLoading(true)
      try {
        const res = await fetch(`/api/clients/history?client_id=${clientId}`)
        const json = await res.json()
        setHistory(json.data ?? [])
      } catch {
        setHistory([])
      } finally {
        setLoading(false)
      }
    }
  }

  const hist = history ?? []
  const abiertas = hist.filter(h => h.status === 'open')
  const ganadas  = hist.filter(h => h.status === 'won')
  const perdidas = hist.filter(h => h.status === 'lost')
  const sum = (arr: HistoryItem[]) => arr.reduce((s, h) => s + Number(h.total ?? 0), 0)
  const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`

  const popover = open ? createPortal(
    // Overlay + modal centrado
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
      className="bg-black/40 backdrop-blur-[2px]"
    >
    <div
      ref={popoverRef}
      style={{ width: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      className="bg-white rounded-2xl border shadow-2xl overflow-hidden"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{clientName}</p>
              {clientRut && <p className="text-xs text-gray-400 font-mono">{clientRut}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <Link
                href={`/clientes?open=${clientId}&tab=historia`}
                className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                onClick={() => setOpen(false)}
              >
                Ver todo <ExternalLink className="w-3 h-3" />
              </Link>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resumen */}
          {!loading && history && history.length > 0 && (
            <div className="flex gap-2 px-4 py-2 border-b bg-gray-50/50 flex-wrap">
              {abiertas.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> {abiertas.length} ab. {fmt(sum(abiertas))}
                </span>
              )}
              {ganadas.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> {ganadas.length} gan. {fmt(sum(ganadas))}
                </span>
              )}
              {perdidas.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> {perdidas.length} perd. {fmt(sum(perdidas))}
                </span>
              )}
            </div>
          )}

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : history === null || history.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">Sin negocios registrados</p>
            ) : (
              <div className="divide-y">
                {history.map(h => {
                  const num = h.number ?? h.pipedrive_deal_id ?? h.id.slice(0, 8)
                  const rawDate = h.fecha_salida ?? h.issue_date ?? h.created_at ?? ''
                  const dateObj = rawDate ? new Date(new Date(rawDate).getTime() + 3 * 60 * 60 * 1000) : null
                  const mesAnio = dateObj ? dateObj.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }) : '—'
                  const amount = h.total ? fmt(Number(h.total)) : '—'
                  const statusLabel = h.status === 'won' ? 'Ganado' : h.status === 'lost' ? 'Perdido' : 'Abierto'
                  const statusStyle = h.status === 'won'
                    ? 'text-green-700 bg-green-50'
                    : h.status === 'lost'
                    ? 'text-red-600 bg-red-50'
                    : 'text-amber-700 bg-amber-50'
                  return (
                    <Link
                      key={h.id}
                      href={`/cotizaciones/${h.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex-shrink-0">
                        {h.status === 'won'
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          : h.status === 'lost'
                          ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                          : <Clock className="w-3.5 h-3.5 text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-800 group-hover:text-blue-600">#{num}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                          <span className="capitalize">{mesAnio}</span>
                          {h.pipeline_name && <><span>·</span><span className="truncate max-w-[100px]">{h.pipeline_name}</span></>}
                          {h.vendedor_name && <><span>·</span><span>{h.vendedor_name.split(' ')[0]}</span></>}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 flex-shrink-0">{amount}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
    </div>
    </div>,
    document.body
  ) : null

  return (
    <div ref={triggerRef} className="space-y-0.5">
      <button
        onClick={toggle}
        className="font-semibold text-sm text-blue-600 hover:text-blue-800 hover:underline text-left leading-tight w-full flex items-center gap-1"
      >
        {clientName}
        <History className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>
      {clientRut && (
        <button
          onClick={toggle}
          className="text-xs text-blue-500 hover:text-blue-700 hover:underline text-left"
        >
          RUT: {clientRut}
        </button>
      )}
      {clientEmail && <p className="text-xs text-gray-500">{clientEmail}</p>}
      {clientPhone && <p className="text-xs text-gray-500">{clientPhone}</p>}
      {clientAddress && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{clientAddress}</p>}
      <Link
        href={`/clientes?open=${clientId}&tab=historia`}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 mt-1"
      >
        <ExternalLink className="w-3 h-3" />
        Ver en Clientes
      </Link>
      {popover}
    </div>
  )
}
