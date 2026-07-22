'use client'

import { useState } from 'react'

function getBrandBadge(company: string | undefined) {
  const c = (company ?? '').toUpperCase()
  if (c.includes('TKS'))      return { label: 'TKS',      bg: '#fef2f2', color: '#C8102E' }
  if (c.includes('TRACKING')) return { label: 'TRACKING',  bg: '#eff6ff', color: '#1d4ed8' }
  return                               { label: 'CCL',      bg: '#f0fdf4', color: '#1B8A4B' }
}
import Link from 'next/link'
import { formatCLP, getStatusLabel } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface Quotation {
  id: string
  number: string
  status: string
  issue_date: string
  expiry_date?: string
  total: number
  client_name?: string
  vendedor_name?: string
  pipeline_name?: string
  pipeline_color?: string
  company?: string
  year?: number
  month?: number
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

export default function TimelineView({ quotations, isAdmin }: Props) {
  const now = new Date()
  const [startMonth, setStartMonth] = useState(now.getMonth() - 1)
  const [startYear, setStartYear] = useState(now.getFullYear())

  const months = Array.from({ length: 5 }, (_, i) => {
    let m = startMonth + i
    let y = startYear
    while (m > 11) { m -= 12; y++ }
    while (m < 0) { m += 12; y-- }
    return { month: m + 1, year: y, label: MONTH_NAMES[m] }
  })

  function shift(delta: number) {
    let m = startMonth + delta
    let y = startYear
    while (m > 11) { m -= 12; y++ }
    while (m < 0) { m += 12; y-- }
    setStartMonth(m)
    setStartYear(y)
  }

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
          const cards = quotations.filter(q => Number(q.month) === month && Number(q.year) === year)
          const totalMonto = cards.reduce((s, q) => s + Number(q.total ?? 0), 0)
          const ganado = cards.filter(q => q.status === 'won').reduce((s, q) => s + Number(q.total ?? 0), 0)
          const perdido = cards.filter(q => q.status === 'lost').reduce((s, q) => s + Number(q.total ?? 0), 0)
          const pendiente = cards.filter(q => q.status === 'open').reduce((s, q) => s + Number(q.total ?? 0), 0)
          const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear()

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
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-bold text-base" style={{ color: isCurrent ? 'var(--pipe-orange)' : '#111827' }}>
                    {label} {year}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: isCurrent ? '#FF6C37' : '#f3f4f6', color: isCurrent ? 'white' : '#6b7280' }}>
                    {cards.length}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatCLP(totalMonto)}</p>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {ganado > 0 && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      {formatCLP(ganado)}
                    </span>
                  )}
                  {pendiente > 0 && (
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                      {formatCLP(pendiente)}
                    </span>
                  )}
                  {perdido > 0 && (
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                      {formatCLP(perdido)}
                    </span>
                  )}
                </div>
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
                  const vColor = q.vendedor_name ? getVendedorColor(q.vendedor_name) : 'var(--pipe-orange)'
                  const progressPct = q.status === 'won' ? 100 : q.status === 'lost' ? 0 : 50

                  const brand = getBrandBadge(q.company)
                  return (
                    <Link key={q.id} href={`/cotizaciones/${q.id}`}>
                      <div className="bg-white rounded-xl border hover:shadow-md transition-all cursor-pointer overflow-hidden group"
                        style={{ borderColor: '#e5e7eb' }}>
                        <div className="p-4">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                                {statusLabel}
                              </span>
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: brand.bg, color: brand.color }}>
                                {brand.label}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-gray-400 truncate">{q.number}</span>
                          </div>

                          {/* Pipeline badge */}
                          {q.pipeline_name && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: q.pipeline_color ?? 'var(--pipe-orange)' }} />
                              <span className="text-xs font-medium truncate"
                                style={{ color: q.pipeline_color ?? 'var(--pipe-orange)' }}>
                                {q.pipeline_name}
                              </span>
                            </div>
                          )}

                          {/* Client name — main title */}
                          <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5 group-hover:text-orange-600 transition-colors line-clamp-2">
                            {q.client_name ?? 'Sin cliente'}
                          </p>

                          {/* Amount */}
                          <p className="text-xl font-bold mt-2 mb-3" style={{ color: 'var(--pipe-orange)' }}>
                            {formatCLP(q.total)}
                          </p>

                          {/* Vendedor */}
                          {isAdmin && q.vendedor_name && (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0"
                                style={{ background: vColor }}>
                                {q.vendedor_name[0]}
                              </div>
                              <span className="text-xs text-gray-500 truncate">{q.vendedor_name}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress bar — like PipeDrive */}
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
