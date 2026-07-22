'use client'

import Link from 'next/link'
import { formatCLP, formatDate } from '@/lib/utils'
import { Calendar, User } from 'lucide-react'

interface Quotation {
  id: string
  number: string
  status: string
  issue_date: string
  expiry_date?: string
  total: number
  client_name?: string
  vendedor_name?: string
}

interface Props {
  quotations: Quotation[]
  isAdmin: boolean
}

const COLUMNS = [
  {
    key: 'open',
    label: 'Abiertas',
    color: '#3b82f6',
    bg: '#eff6ff',
    dot: '#3b82f6',
  },
  {
    key: 'won',
    label: 'Ganadas',
    color: '#16a34a',
    bg: '#f0fdf4',
    dot: '#16a34a',
  },
  {
    key: 'lost',
    label: 'Perdidas',
    color: '#dc2626',
    bg: '#fef2f2',
    dot: '#dc2626',
  },
]

export default function KanbanView({ quotations, isAdmin }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {COLUMNS.map(col => {
        const cards = quotations.filter(q => q.status === col.key)
        const total = cards.reduce((s, q) => s + (Number(q.total) || 0), 0)

        return (
          <div key={col.key} className="flex-shrink-0 w-72 flex flex-col gap-3">
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: col.bg }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: col.dot }}
                />
                <span className="font-semibold text-sm" style={{ color: col.color }}>
                  {col.label}
                </span>
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: col.color, color: 'white' }}
                >
                  {cards.length}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-500">
                {formatCLP(total)}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2.5">
              {cards.length === 0 && (
                <div
                  className="rounded-xl border-2 border-dashed p-6 text-center"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <p className="text-xs text-gray-400">Sin cotizaciones</p>
                </div>
              )}
              {cards.map(q => (
                <Link key={q.id} href={`/cotizaciones/${q.id}`}>
                  <div
                    className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow cursor-pointer"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    {/* Number */}
                    <p className="text-xs font-mono text-gray-400 mb-1.5">{q.number}</p>

                    {/* Client */}
                    <p className="font-semibold text-gray-900 text-sm leading-tight mb-3">
                      {q.client_name ?? 'Sin cliente'}
                    </p>

                    {/* Amount */}
                    <p
                      className="text-lg font-bold mb-3"
                      style={{ color: 'var(--pipe-orange)' }}
                    >
                      {formatCLP(q.total)}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-col gap-1">
                      {q.expiry_date && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>Vence {formatDate(q.expiry_date)}</span>
                        </div>
                      )}
                      {isAdmin && q.vendedor_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <User className="w-3 h-3" />
                          <span>{q.vendedor_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
