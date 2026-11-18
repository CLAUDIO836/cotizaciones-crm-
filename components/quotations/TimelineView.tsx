'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCLP, getStatusLabel } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertTriangle } from 'lucide-react'

function getBrandBadge(company: string | undefined) {
  const c = (company ?? '').toUpperCase()
  if (c.includes('TKS'))      return { label: 'TKS',      bg: '#fef2f2', color: '#C8102E' }
  if (c.includes('TRACKING')) return { label: 'TRACKING',  bg: '#eff6ff', color: '#1d4ed8' }
  return                               { label: 'CCL',      bg: '#f0fdf4', color: '#1B8A4B' }
}

interface Quotation {
  id: string
  number: string
  status: string
  issue_date: string
  expiry_date?: string
  fecha_salida?: string
  total: number
  client_name?: string
  vendedor_name?: string
  pipeline_name?: string
  pipeline_color?: string
  company?: string
  year?: number
  month?: number
  activity_count?: number
}

interface Props {
  quotations: Quotation[]
  isAdmin: boolean
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const VENDEDOR_COLORS = [
  '#FF6C37','#3b82f6','#16a34a','#9333ea',
  '#f59e0b','#ec4899','#14b8a6','#6366f1',
]

const vendedorColorMap: Record<string, string> = {}
let colorIdx = 0
function getVendedorColor(name: string) {
  if (!vendedorColorMap[name]) {
    vendedorColorMap[name] = VENDEDOR_COLORS[colorIdx % VENDEDOR_COLORS.length]
    colorIdx++
  }
  return vendedorColorMap[name]
}

function getClosePrev(q: Quotation): string | null {
  return q.fecha_salida?.slice(0, 10) ?? null
}

function daysUntil(dateStr: string, today: string): number {
  const a = new Date(dateStr + 'T12:00:00')
  const b = new Date(today  + 'T12:00:00')
  return Math.ceil((a.getTime() - b.getTime()) / 86400000)
}

function todayStr(): string {
  const now = new Date()
  // hora Chile (UTC-3)
  const chile = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return chile.toISOString().slice(0, 10)
}

function formatDateShort(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export default function TimelineView({ quotations, isAdmin }: Props) {
  const now = new Date()
  const [startMonth, setStartMonth] = useState(now.getMonth() - 1)
  const [startYear, setStartYear] = useState(now.getFullYear())

  const months = Array.from({ length: 5 }, (_, i) => {
    let m = startMonth + i
    let y = startYear
    while (m > 11) { m -= 12; y++ }
    while (m < 0)  { m += 12; y-- }
    return { month: m + 1, year: y, label: MONTH_NAMES[m] }
  })

  function shift(delta: number) {
    let m = startMonth + delta
    let y = startYear
    while (m > 11) { m -= 12; y++ }
    while (m < 0)  { m += 12; y-- }
    setStartMonth(m)
    setStartYear(y)
  }

  const today = todayStr()

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => shift(-3)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50">
          <ChevronsLeft className="w-4 h-4 text-gray-500" />
        </button>
        <button onClick={() => shift(-1)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <button onClick={() => { setStartMonth(now.getMonth() - 1); setStartYear(now.getFullYear()) }}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
          Hoy
        </button>
        <button onClick={() => shift(1)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
        <button onClick={() => shift(3)} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50">
          <ChevronsRight className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm text-gray-500 ml-2">
          {months[0].label} {months[0].year} — {months[4].label} {months[4].year}
        </span>
      </div>

      {/* Columnas */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {months.map(({ month, year, label }) => {
          const all    = quotations.filter(q => Number(q.month) === month && Number(q.year) === year)

          // Ordenar: ganadas → abiertas → perdidas
          const won    = all.filter(q => q.status === 'won')
          const open   = all.filter(q => q.status === 'open')
          const lost   = all.filter(q => q.status === 'lost')
          const cards  = [...won, ...open, ...lost]

          const totalMonto  = all.reduce((s, q) => s + Number(q.total ?? 0), 0)
          const totalGanado = won.reduce( (s, q) => s + Number(q.total ?? 0), 0)
          const totalOpen   = open.reduce((s, q) => s + Number(q.total ?? 0), 0)
          const totalLost   = lost.reduce((s, q) => s + Number(q.total ?? 0), 0)
          const isCurrent   = month === now.getMonth() + 1 && year === now.getFullYear()

          return (
            <div key={`${year}-${month}`} className="flex-shrink-0 flex flex-col" style={{ width: 300 }}>
              {/* Header mes */}
              <div
                className="rounded-xl px-4 py-3 mb-3"
                style={{
                  background: isCurrent ? '#fff3ee' : 'white',
                  border: isCurrent ? '2px solid var(--pipe-orange)' : '1px solid #e5e7eb',
                }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-bold text-base" style={{ color: isCurrent ? 'var(--pipe-orange)' : '#111827' }}>
                    {label} {year}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: isCurrent ? '#FF6C37' : '#f3f4f6', color: isCurrent ? 'white' : '#6b7280' }}>
                    {all.length}
                  </span>
                </div>

                {/* Número grande = ganado */}
                <p className="text-xl font-bold" style={{ color: '#16a34a' }}>
                  {formatCLP(totalGanado)}
                </p>

                {/* Abierto */}
                {totalOpen > 0 && (
                  <p className="text-sm font-semibold mt-0.5" style={{ color: '#2563eb' }}>
                    {formatCLP(totalOpen)}
                  </p>
                )}

                {/* Perdido */}
                {totalLost > 0 && (
                  <p className="text-sm font-semibold mt-0.5" style={{ color: '#dc2626' }}>
                    {formatCLP(totalLost)}
                  </p>
                )}

                {/* Total cotizado */}
                <p className="text-xs text-gray-400 mt-1 font-medium border-t border-gray-100 pt-1">
                  = {formatCLP(totalMonto)} cotizado
                </p>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {cards.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: '#e5e7eb' }}>
                    <p className="text-xs text-gray-400">Sin cotizaciones</p>
                  </div>
                )}
                {cards.map(q => {
                  const { label: statusLabel, color } = getStatusLabel(q.status)
                  const vColor     = q.vendedor_name ? getVendedorColor(q.vendedor_name) : 'var(--pipe-orange)'
                  const brand      = getBrandBadge(q.company)
                  const closePrev  = getClosePrev(q)
                  const daysLeft   = closePrev ? daysUntil(closePrev, today) : null
                  const overdue    = q.status === 'open' && daysLeft !== null && daysLeft < 0
                  const nearClose  = q.status === 'open' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2
                  const noGestion  = q.status === 'open' && (q.activity_count ?? 0) === 0

                  // Fondo y borde por estado
                  let cardStyle: React.CSSProperties
                  if (q.status === 'won')       cardStyle = { background: '#f0fdf4', borderColor: '#86efac' }
                  else if (q.status === 'lost') cardStyle = { background: '#fff5f5', borderColor: '#fca5a5' }
                  else                          cardStyle = { background: '#eff6ff', borderColor: '#bfdbfe' }

                  const progressPct = q.status === 'won' ? 100 : q.status === 'lost' ? 0 : 50

                  return (
                    <Link key={q.id} href={`/cotizaciones/${q.id}`}>
                      <div className="rounded-xl border hover:shadow-md transition-all cursor-pointer overflow-hidden group"
                        style={cardStyle}>

                        {/* Alertas top — solo deals abiertos */}
                        {(overdue || nearClose || noGestion) && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-2 pb-0">
                            {overdue && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                Requiere tu intervención
                              </span>
                            )}
                            {!overdue && nearClose && (
                              <span className="text-xs font-semibold text-orange-500">
                                🔔 {daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : `En ${daysLeft} días`}
                              </span>
                            )}
                            {noGestion && (
                              <span className="text-xs font-semibold text-red-600">
                                🚨 Sin gestión
                              </span>
                            )}
                          </div>
                        )}

                        <div className="px-3 py-2">
                          {/* Top row */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`inline-flex px-1.5 py-0 rounded-full text-xs font-semibold ${color}`}>
                                {statusLabel}
                              </span>
                              <span className="inline-flex px-1.5 py-0 rounded-full text-xs font-bold"
                                style={{ background: brand.bg, color: brand.color }}>
                                {brand.label}
                              </span>
                              {q.pipeline_name && (
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: q.pipeline_color ?? '#1B8A4B' }} />
                                  <span className="text-xs font-medium truncate"
                                    style={{ color: q.pipeline_color ?? '#1B8A4B' }}>
                                    {q.pipeline_name}
                                  </span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-gray-400 truncate flex-shrink-0">{q.number}</span>
                          </div>

                          {/* Client name */}
                          <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5 group-hover:text-orange-600 transition-colors line-clamp-1">
                            {q.client_name ?? 'Sin cliente'}
                          </p>

                          {/* Amount + Vendedor */}
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-base font-bold" style={{ color: 'var(--pipe-orange)' }}>
                              {formatCLP(q.total)}
                            </p>
                            {isAdmin && q.vendedor_name && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase"
                                  style={{ background: vColor }}>
                                  {q.vendedor_name[0]}
                                </div>
                                <span className="text-xs text-gray-500 truncate max-w-[70px]">{q.vendedor_name}</span>
                              </div>
                            )}
                          </div>

                          {/* Fecha de cierre previsto — todos los estados */}
                          {closePrev && (
                            <p className={`text-xs mt-1 font-medium ${
                              overdue        ? 'text-amber-600' :
                              nearClose      ? 'text-orange-500' :
                              q.status === 'won'  ? 'text-green-600' :
                              q.status === 'lost' ? 'text-red-500' :
                              'text-gray-400'
                            }`}>
                              {q.status === 'won' ? '✅' : q.status === 'lost' ? '❌' : '📅'} {formatDateShort(closePrev)}
                            </p>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 w-full bg-gray-100">
                          <div
                            className="h-1 transition-all"
                            style={{
                              width: `${progressPct}%`,
                              background: q.status === 'won' ? '#16a34a' : q.status === 'lost' ? '#dc2626' : 'var(--pipe-orange)',
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
