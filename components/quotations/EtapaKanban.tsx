'use client'

import { useState } from 'react'

function getBrandBadge(company: string | undefined) {
  const c = (company ?? '').toUpperCase()
  if (c.includes('TKS'))      return { label: 'TKS',      bg: '#fef2f2', color: '#C8102E' }
  if (c.includes('TRACKING')) return { label: 'TRACKING',  bg: '#eff6ff', color: '#1d4ed8' }
  return                               { label: 'CCL',      bg: '#f0fdf4', color: '#1B8A4B' }
}
import Link from 'next/link'
import { formatCLP, formatDate } from '@/lib/utils'
import { Calendar, User } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'

interface Quotation {
  id: string
  number: string
  status: string
  etapa?: string
  issue_date: string
  expiry_date?: string
  total: number
  client_name?: string
  vendedor_name?: string
  pipeline_name?: string
  pipeline_color?: string
  company?: string
}

interface Props {
  quotations: Quotation[]
  isAdmin: boolean
}

const ETAPAS = [
  { key: 'lead',        label: 'Lead',        color: '#6366f1', bg: '#eef2ff' },
  { key: 'contactado',  label: 'Contactado',  color: '#0ea5e9', bg: '#f0f9ff' },
  { key: 'cotizacion',  label: 'Cotización',  color: '#F2B705', bg: '#fffbeb' },
  { key: 'negociacion', label: 'Negociación', color: '#f97316', bg: '#fff7ed' },
  { key: 'cierre',      label: 'Cierre',      color: '#1B8A4B', bg: '#f0fdf4' },
]

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  open:  { label: 'Abierta',  color: '#0ea5e9', bg: '#e0f2fe' },
  won:   { label: 'Ganada',   color: '#1B8A4B', bg: '#dcfce7' },
  lost:  { label: 'Perdida',  color: '#D33A2C', bg: '#fee2e2' },
}

function QuotationCard({
  q,
  isAdmin,
  isDragging = false,
}: {
  q: Quotation
  isAdmin: boolean
  isDragging?: boolean
}) {
  const st = STATUS_STYLE[q.status] ?? STATUS_STYLE.open
  const brand = getBrandBadge(q.company)
  return (
    <div
      className="bg-white rounded-xl border p-4 cursor-grab active:cursor-grabbing"
      style={{
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
        opacity: isDragging ? 0.95 : 1,
        borderColor: isDragging ? '#1B8A4B' : '#e5e7eb',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono text-gray-400">{q.number}</p>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: brand.bg, color: brand.color }}
          >
            {brand.label}
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: st.bg, color: st.color }}
          >
            {st.label}
          </span>
        </div>
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-tight mb-2">
        {q.client_name ?? 'Sin cliente'}
      </p>
      {q.pipeline_name && (
        <span
          className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium mb-2"
          style={{
            background: `${q.pipeline_color ?? '#6b7280'}18`,
            color: q.pipeline_color ?? '#6b7280',
          }}
        >
          {q.pipeline_name}
        </span>
      )}
      <p className="text-base font-bold mb-2" style={{ color: '#1B8A4B' }}>
        {formatCLP(q.total)}
      </p>
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
  )
}

function DraggableCard({ q, isAdmin }: { q: Quotation; isAdmin: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: q.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.3 : 1 }}>
      <Link href={`/cotizaciones/${q.id}`} onClick={e => { if (isDragging) e.preventDefault() }}>
        <QuotationCard q={q} isAdmin={isAdmin} />
      </Link>
    </div>
  )
}

function DroppableColumn({
  etapa,
  cards,
  isAdmin,
  isOver,
}: {
  etapa: typeof ETAPAS[0]
  cards: Quotation[]
  isAdmin: boolean
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: etapa.key })
  const total = cards.reduce((s, q) => s + (q.total ?? 0), 0)

  return (
    <div className="flex-shrink-0 w-72 flex flex-col gap-3">
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-xl"
        style={{ background: etapa.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: etapa.color }} />
          <span className="font-semibold text-sm" style={{ color: etapa.color }}>{etapa.label}</span>
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
            style={{ background: etapa.color }}
          >
            {cards.length}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500">{formatCLP(total)}</span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col gap-2.5 min-h-32 rounded-xl transition-colors p-1"
        style={{ background: isOver ? `${etapa.color}08` : 'transparent' }}
      >
        {cards.length === 0 && (
          <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: isOver ? etapa.color : '#e5e7eb' }}>
            <p className="text-xs text-gray-400">Arrastra aquí</p>
          </div>
        )}
        {cards.map(q => (
          <DraggableCard key={q.id} q={q} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  )
}

export default function EtapaKanban({ quotations: initialQuotations, isAdmin }: Props) {
  const [quotations, setQuotations] = useState(initialQuotations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeQ = activeId ? quotations.find(q => q.id === activeId) : null

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverId(over?.id as string ?? null)
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setOverId(null)
    if (!over) return
    const targetEtapa = over.id as string
    const quotation = quotations.find(q => q.id === active.id)
    if (!quotation || quotation.etapa === targetEtapa) return

    // Optimistic update
    setQuotations(prev =>
      prev.map(q => q.id === active.id ? { ...q, etapa: targetEtapa } : q)
    )

    await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'set_etapa', id: active.id, etapa: targetEtapa }),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {ETAPAS.map(etapa => {
          const cards = quotations.filter(q => (q.etapa ?? 'lead') === etapa.key)
          return (
            <DroppableColumn
              key={etapa.key}
              etapa={etapa}
              cards={cards}
              isAdmin={isAdmin}
              isOver={overId === etapa.key}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeQ && <QuotationCard q={activeQ} isAdmin={isAdmin} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
