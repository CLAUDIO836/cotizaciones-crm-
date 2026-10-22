'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Phone, PhoneIncoming, PhoneOutgoing, ExternalLink, Search, X, Trash2 } from 'lucide-react'

interface CallRow {
  id: string
  user_id: string
  executive_name: string
  to_number: string
  called_at: string
  called_at_cl?: string
  direction: 'outbound' | 'inbound'
  duration_sec: number | null
  recording_url: string | null
  contact_id: string | null
  contact_name: string | null
  prospect_id: string | null
  prospect_company: string | null
}

interface Props {
  calls: CallRow[]
  executives: { id: string; name: string }[]
  isAdmin: boolean
}

function formatNumber(n: string) {
  const d = n.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('56')) return `+56 ${d[2]} ${d.slice(3,7)} ${d.slice(7)}`
  if (d.length === 9) return `+56 ${d[0]} ${d.slice(1,5)} ${d.slice(5)}`
  return n
}

function formatDuration(sec: number | null) {
  if (!sec) return null
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`
}

function formatTime(dt?: string | null) {
  if (!dt) return { date: '—', time: '', dateVal: '' }
  const [date, time] = dt.split(' ')
  const [y, m, d] = (date ?? '').split('-')
  if (!d) return { date: dt, time: '', dateVal: date ?? '' }
  return { date: `${d}/${m}/${y}`, time: time?.slice(0,5) ?? '', dateVal: date ?? '' }
}

const CRM_API = 'https://www.transccl.cl/crm-api.php'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - i)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function LlamadasClient({ calls, executives, isAdmin }: Props) {
  const [search, setSearch]     = useState('')
  const [rows, setRows]         = useState(calls)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [executive, setExecutive] = useState('')
  const [direction, setDirection] = useState('')
  const [quickYear, setQuickYear]   = useState('')
  const [quickMonth, setQuickMonth] = useState('')

  function applyQuick(year: string, month: string) {
    setQuickYear(year); setQuickMonth(month)
    if (!year) { setDateFrom(''); setDateTo(''); return }
    const y = parseInt(year)
    if (month) {
      const m = parseInt(month)
      const last = new Date(y, m, 0).getDate()
      setDateFrom(`${y}-${String(m).padStart(2,'0')}-01`)
      setDateTo(`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`)
    } else {
      setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`)
    }
  }

  async function deleteCall(id: string) {
    if (!confirm('¿Eliminar esta llamada del historial?')) return
    const res = await fetch(`/api/llamadas/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setRows(r => r.filter(c => c.id !== id))
  }

  const filtered = useMemo(() => {
    return rows.filter(c => {
      const dt = formatTime(c.called_at_cl ?? c.called_at)
      if (dateFrom && dt.dateVal < dateFrom) return false
      if (dateTo   && dt.dateVal > dateTo)   return false
      if (executive && c.user_id !== executive) return false
      if (direction && (c.direction ?? 'outbound') !== direction) return false
      if (search) {
        const q = search.toLowerCase()
        const match =
          c.to_number.includes(q) ||
          (c.executive_name ?? '').toLowerCase().includes(q) ||
          (c.contact_name ?? '').toLowerCase().includes(q) ||
          (c.prospect_company ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [calls, dateFrom, dateTo, executive, direction, search])

  const outbound = filtered.filter(c => c.direction !== 'inbound')
  const inbound  = filtered.filter(c => c.direction === 'inbound')
  const known    = filtered.filter(c => c.contact_id)

  function clearFilters() {
    setSearch(''); setDateFrom(''); setDateTo(''); setExecutive(''); setDirection('')
    setQuickYear(''); setQuickMonth('')
  }

  const hasFilters = search || dateFrom || dateTo || executive || direction

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#1B8A4B' }}>
          <Phone className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Historial de llamadas</h1>
          <p className="text-sm text-gray-500">Llamadas realizadas y recibidas desde el CRM</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        {/* Accesos rápidos */}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => { const t = todayStr(); setDateFrom(t); setDateTo(t); setQuickYear(''); setQuickMonth('') }}
            className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${dateFrom === todayStr() && dateTo === todayStr() ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Hoy
          </button>
          <select value={quickYear} onChange={e => applyQuick(e.target.value, quickMonth)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
            <option value="">Año</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={quickMonth} onChange={e => applyQuick(quickYear, e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
            <option value="">Mes</option>
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          {isAdmin && (
            <select value={executive} onChange={e => setExecutive(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
              <option value="">Todos los ejecutivos</option>
              {executives.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Número, contacto, empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Desde */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Hasta */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Asesor (solo admin) */}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Asesor</label>
              <select value={executive} onChange={e => setExecutive(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">Todos</option>
                {executives.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Dirección */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Tipo</label>
            <select value={direction} onChange={e => setDirection(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
              <option value="">Todas</option>
              <option value="outbound">Salientes</option>
              <option value="inbound">Entrantes</option>
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: filtered.length, color: 'text-gray-900' },
          { label: 'Salientes', value: outbound.length, color: 'text-blue-600' },
          { label: 'Entrantes', value: inbound.length, color: 'text-purple-600' },
          { label: 'Conocidos', value: known.length, color: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ejecutivo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto / Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Duración</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Grabación</th>
              {isAdmin && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay llamadas registradas aún'}
                </td>
              </tr>
            )}
            {filtered.map(c => {
              const { date, time } = formatTime(c.called_at_cl ?? c.called_at)
              const isIn = c.direction === 'inbound'
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-800 text-xs">{date}</div>
                    <div className="text-xs text-gray-400">{time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${isIn ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {isIn ? <PhoneIncoming className="w-3 h-3" /> : <PhoneOutgoing className="w-3 h-3" />}
                      </span>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: '#1B8A4B' }}>
                        {(c.executive_name ?? '?')[0]}
                      </div>
                      <span className="text-gray-700 text-xs">{c.executive_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">
                    {formatNumber(c.to_number)}
                  </td>
                  <td className="px-4 py-3">
                    {c.contact_id ? (
                      <Link href={`/prospectos/${c.prospect_id}`} className="group flex items-center gap-1 hover:underline">
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-green-700 text-xs">{c.contact_name}</div>
                          {c.prospect_company && <div className="text-xs text-gray-400">{c.prospect_company}</div>}
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-green-600 flex-shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-xs text-orange-400">Número externo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {formatDuration(c.duration_sec) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.recording_url
                      ? <audio controls className="h-7 w-24" src={`/api/twilio/recording-proxy?url=${encodeURIComponent(c.recording_url)}`} />
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-3">
                      <button onClick={() => deleteCall(c.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
