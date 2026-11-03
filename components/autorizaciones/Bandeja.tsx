'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatCLP } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, Ban } from 'lucide-react'

export interface Autorizacion {
  id: string
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'anulada'
  tipo: 'descuento' | 'recargo' | 'descuento_recargo' | 'a_medida'
  referencia: string | null
  detalle: string | null
  precio_lista: number | null
  precio_minimo: number | null
  precio_solicitado: number | null
  recargos: { tipo: string; mensaje: string; sugerido?: string }[]
  requested_by: string
  requested_by_name: string | null
  decided_by_name: string | null
  decided_at: string | null
  comentario: string | null
  created_at: string
}

const TIPO_LABEL: Record<Autorizacion['tipo'], string> = {
  descuento: 'Descuento bajo el mínimo',
  recargo: 'Recargo',
  descuento_recargo: 'Descuento y recargo',
  a_medida: 'Cotización a medida',
}

const ESTADO: Record<Autorizacion['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  aprobada: { label: 'Aprobada', cls: 'bg-green-50 text-green-800 border-green-200', Icon: CheckCircle2 },
  rechazada: { label: 'Rechazada', cls: 'bg-red-50 text-red-800 border-red-200', Icon: XCircle },
  anulada: { label: 'Anulada', cls: 'bg-gray-50 text-gray-600 border-gray-200', Icon: Ban },
}

// Las fechas se guardan en hora de Chile
const fecha = (s: string | null) => s ? new Date(s.replace(' ', 'T')).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''

function Tarjeta({ a, esAprobador, miId, onCambio }: {
  a: Autorizacion; esAprobador: boolean; miId: string; onCambio: () => void
}) {
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const e = ESTADO[a.status]
  const bajaPct = a.precio_lista && a.precio_solicitado ? 1 - a.precio_solicitado / a.precio_lista : null

  async function accion(_action: 'decide' | 'cancel' | 'reopen', decision?: 'aprobada' | 'rechazada') {
    setEnviando(true)
    const res = await fetch('/api/autorizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action, id: a.id, decision, comentario: comentario || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) { toast.error(json.error ?? 'No se pudo guardar'); onCambio(); return }
    toast.success(_action === 'cancel' ? 'Solicitud anulada' : _action === 'reopen' ? 'Solicitud reenviada a pendiente' : decision === 'aprobada' ? 'Aprobada' : 'Rechazada')
    onCambio()
  }

  return (
    <article className="bg-white rounded-xl border p-4 space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{TIPO_LABEL[a.tipo]}</div>
          <h3 className="font-semibold text-gray-900 break-words">{a.referencia}</h3>
          <p className="text-xs text-gray-500">Pedido por {a.requested_by_name} · {fecha(a.created_at)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${e.cls}`}>
          <e.Icon className="h-3.5 w-3.5" />{e.label}
        </span>
      </header>

      {(a.precio_lista !== null || a.precio_solicitado !== null) && (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Lista</dt><dd className="font-semibold tabular-nums">{a.precio_lista !== null ? formatCLP(a.precio_lista) : '—'}</dd></div>
          <div className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">Mínimo</dt><dd className="font-semibold tabular-nums">{a.precio_minimo !== null ? formatCLP(a.precio_minimo) : '—'}</dd></div>
          <div className="rounded-lg bg-amber-50 p-2"><dt className="text-xs text-amber-800">Solicitado</dt>
            <dd className="font-semibold tabular-nums">{a.precio_solicitado !== null ? formatCLP(a.precio_solicitado) : '—'}
              {bajaPct !== null && bajaPct > 0 && <span className="block text-xs font-normal text-amber-800">{(bajaPct * 100).toFixed(1)}% bajo la lista</span>}
            </dd>
          </div>
        </dl>
      )}

      {a.recargos.length > 0 && (
        <ul className="text-sm space-y-1">
          {a.recargos.map(r => <li key={r.tipo}>• {r.mensaje}{r.sugerido && <span className="text-gray-500"> Sugerido: {r.sugerido}.</span>}</li>)}
        </ul>
      )}
      {a.detalle && <pre className="whitespace-pre-wrap text-xs text-gray-600 font-sans bg-gray-50 rounded-lg p-2">{a.detalle}</pre>}

      {a.status !== 'pendiente' && (
        <div className=”space-y-2”>
          <p className=”text-sm text-gray-700”>
            {e.label} por {a.decided_by_name} · {fecha(a.decided_at)}{a.comentario && <> — “{a.comentario}”</>}
          </p>
          {a.status === 'anulada' && (esAprobador || a.requested_by === miId) && (
            <Button type=”button” variant=”outline” size=”sm” disabled={enviando}
              onClick={() => accion('reopen')}>
              ↩ Reenviar a pendiente
            </Button>
          )}
        </div>
      )}

      {a.status === 'pendiente' && (esAprobador || a.requested_by === miId) && (
        <div className="space-y-2">
          {esAprobador && (
            <Textarea value={comentario} onChange={ev => setComentario(ev.target.value)} rows={2}
              placeholder="Comentario (opcional): condiciones, monto aprobado del recargo, etc." />
          )}
          <div className="flex flex-wrap gap-2">
            {esAprobador && <>
              <Button type="button" disabled={enviando} onClick={() => accion('decide', 'aprobada')} style={{ background: '#1B8A4B' }}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Aprobar
              </Button>
              <Button type="button" variant="outline" disabled={enviando} onClick={() => accion('decide', 'rechazada')}>
                <XCircle className="h-4 w-4 mr-1" />Rechazar
              </Button>
            </>}
            {a.requested_by === miId && (
              <Button type="button" variant="ghost" disabled={enviando} onClick={() => accion('cancel')}>Anular mi solicitud</Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

export default function Bandeja({ miId }: { miId: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'pendiente' | 'resuelta'>('pendiente')
  const [datos, setDatos] = useState<{ es_aprobador: boolean; items: Autorizacion[] } | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async (est: 'pendiente' | 'resuelta') => {
    try {
      const res = await fetch(`/api/autorizaciones?estado=${est}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo cargar'); return }
      setError(''); setDatos(json.data)
    } catch { setError('No se pudo cargar') }
  }, [])

  useEffect(() => {
    let vivo = true
    const tick = () => { if (vivo) void cargar(estado) }
    tick()
    const id = setInterval(tick, 30000)
    return () => { vivo = false; clearInterval(id) }
  }, [estado, cargar])

  function alCambiar() { void cargar(estado); router.refresh() }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['pendiente', 'Pendientes'], ['resuelta', 'Resueltas']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setEstado(v)}
            className="h-9 rounded-md border px-4 text-sm font-medium"
            style={estado === v ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' } : {}}>
            {l}
          </button>
        ))}
      </div>
      {datos && !datos.es_aprobador && (
        <p className="text-sm text-gray-500">Aquí ves tus solicitudes. Las aprueban Claudio, Claudia o Paola.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!datos && !error && <p className="text-sm text-gray-500">Cargando…</p>}
      {datos && datos.items.length === 0 && (
        <div className="bg-white rounded-xl border p-6 text-sm text-gray-500">
          {estado === 'pendiente' ? 'No hay solicitudes pendientes.' : 'Todavía no hay solicitudes resueltas.'}
          {' '}Las solicitudes se crean desde el Cotizador con “Solicitar aprobación”.
        </div>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {datos?.items.map(a => <Tarjeta key={a.id} a={a} esAprobador={datos.es_aprobador} miId={miId} onCambio={alCambiar} />)}
      </div>
    </div>
  )
}
