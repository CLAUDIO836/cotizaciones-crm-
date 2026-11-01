'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatCLP } from '@/lib/utils'
import type { FormatoId, Modalidad, ResultadoTarifa } from '@/lib/tarifario'
import type { TarifaRef } from '@/lib/cotizador-handoff'
import { Calculator, AlertTriangle } from 'lucide-react'

// Panel "Tarifa TransCCL" del formulario de cotización (salidas).
// Usa el mismo motor que el Cotizador (/api/tarifa).

const FORMATOS: { id: FormatoId; label: string }[] = [
  { id: 'bus45', label: 'Bus 45' }, { id: 'taxibus30', label: 'Taxibús 30' }, { id: 'taxibus25', label: 'Taxibús 25' },
  { id: 'minibus19', label: 'Minibús 19' }, { id: 'minibus17', label: 'Minibús 17' }, { id: 'minibus15', label: 'Minibús 15' },
  { id: 'van11', label: 'Van 11' },
]
const MODALIDADES: { id: Modalidad; label: string }[] = [
  { id: 'mismo_dia', label: 'Mismo día' }, { id: 'otro_dia', label: 'Regreso otro día' },
  { id: 'solo_ida', label: 'Solo ida' }, { id: 'a_disposicion', label: 'A disposición' },
]
const SELECT_CLS = 'h-9 rounded-md border border-input bg-white px-2 text-sm'

export default function TarifaPanel({ kmMaps, formatoInicial, fechaSalida, fechaRetorno, onAplicar }: {
  kmMaps: number | null
  formatoInicial: FormatoId
  fechaSalida: string   // YYYY-MM-DDTHH:MM
  fechaRetorno: string
  onAplicar: (precio: number, tarifa: TarifaRef) => void
}) {
  const [formato, setFormato] = useState<FormatoId>(formatoInicial)
  const [modalidad, setModalidad] = useState<Modalidad>('mismo_dia')
  const [kmManual, setKmManual] = useState('')
  const [calculo, setCalculo] = useState<ResultadoTarifa | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const km = kmManual.trim() !== '' ? Number(kmManual.replace(',', '.')) : kmMaps
  const kmValido = km !== null && Number.isFinite(km) && km >= 0

  useEffect(() => {
    clearTimeout(timer.current)
    if (!kmValido) return
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/tarifa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servicio: 'salida', km, formato, modalidad,
            fecha: fechaSalida.slice(0, 10) || undefined,
            horaSalida: fechaSalida.slice(11, 16) || undefined,
            horaRegreso: fechaRetorno.slice(11, 16) || undefined,
          }),
        })
        const json = await res.json()
        if (res.ok) setCalculo(json.data)
      } catch { /* el panel queda con el último cálculo */ }
    }, 250)
  }, [kmValido, km, formato, modalidad, fechaSalida, fechaRetorno])

  const r = kmValido ? calculo : null

  return (
    <div className="rounded-xl border border-amber-200 p-5 space-y-3" style={{ background: '#fffbeb' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: '#92400e' }}>Tarifa TransCCL</h2>
        </div>
        <button type="button" disabled={!r || r.precioLista === null}
          onClick={() => r && r.precioLista !== null && km !== null && onAplicar(r.precioLista, { servicio: 'salida', formato, km, modalidad })}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: '#1B8A4B' }}>
          ✓ Aplicar precio lista al ítem
        </button>
      </div>
      <div className="flex gap-3 flex-wrap items-center text-sm">
        <select aria-label="Formato" className={SELECT_CLS} value={formato} onChange={e => setFormato(e.target.value as FormatoId)}>
          {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select aria-label="Modalidad" className={SELECT_CLS} value={modalidad} onChange={e => setModalidad(e.target.value as Modalidad)}>
          {MODALIDADES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-medium whitespace-nowrap">Km de ida</span>
          <Input inputMode="decimal" value={kmManual} onChange={e => setKmManual(e.target.value)}
            placeholder={kmMaps !== null ? String(kmMaps) : '0'} className="w-24 text-right text-sm" />
          {kmMaps !== null && kmManual === '' && <span className="text-xs text-green-700 font-medium">↑ Google Maps</span>}
        </div>
      </div>
      {!kmValido && <p className="text-xs text-gray-600">Elige Desde y Hasta desde las sugerencias de Google o escribe los km.</p>}
      {r && r.precioLista !== null && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg p-2.5 border-2 border-green-300" style={{ background: '#f0fdf4' }}>
            <div className="text-xs font-semibold uppercase mb-0.5" style={{ color: '#1B8A4B' }}>Precio lista</div>
            <div className="font-bold text-lg tabular-nums" style={{ color: '#1B8A4B' }}>{formatCLP(r.precioLista)}</div>
          </div>
          <div className="rounded-lg p-2.5 bg-white border border-amber-100">
            <div className="text-xs text-gray-400 font-semibold uppercase mb-0.5">Mínimo sin aprobación</div>
            <div className="font-bold text-gray-800 tabular-nums">{formatCLP(r.precioMinimo!)}</div>
          </div>
          <div className="rounded-lg p-2.5 bg-white border border-amber-100 col-span-2 sm:col-span-1">
            <div className="text-xs text-gray-400 font-semibold uppercase mb-0.5">Cálculo</div>
            <div className="text-xs text-gray-700">{r.detalle.join(' · ')}</div>
          </div>
        </div>
      )}
      {r && r.alertas.length > 0 && (
        <ul className="text-xs text-amber-900 space-y-0.5">
          {r.alertas.map(a => <li key={a.tipo} className="flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{a.mensaje}{a.requiereAprobacion && ' Se cobra solo con aprobación.'}</li>)}
        </ul>
      )}
    </div>
  )
}
