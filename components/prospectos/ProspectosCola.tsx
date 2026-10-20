'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Campaign, Prospect, ProspectStatus, STATUS_LABELS, STATUS_COLORS, daysSince, daysUntil } from '@/lib/prospectos-types'
import { UserSession } from '@/lib/api'

const DAILY_GOAL = 35

function DaysChip({ prospect }: { prospect: Prospect }) {
  const days = daysSince(prospect.last_activity_at ?? undefined)
  const until = daysUntil(prospect.next_contact ?? undefined)

  if (prospect.status === 'new') return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600">Nueva</span>
  )
  if (until !== null && until <= 0) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600">Vence hoy</span>
  )
  if (until !== null && until > 0) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-yellow-50 text-yellow-600">En {until}d</span>
  )
  if (days !== null && days > 14) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600">Hace {days}d</span>
  )
  if (days !== null) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">Hace {days}d</span>
  )
  return null
}

export default function ProspectosCola({
  campaign, prospects, communes, user, filters,
}: {
  campaign: Campaign
  prospects: Prospect[]
  communes: string[]
  user: UserSession
  filters: { status?: string; commune?: string; q?: string }
}) {
  const router = useRouter()
  const [search, setSearch] = useState(filters.q ?? '')
  const [, startTransition] = useTransition()

  const todayContacted = prospects.filter(p => {
    if (!p.last_activity_at) return false
    return new Date(p.last_activity_at).toDateString() === new Date().toDateString()
  }).length

  const pct = Math.min(100, Math.round((todayContacted / DAILY_GOAL) * 100))
  const circumference = 2 * Math.PI * 27
  const dashoffset = circumference * (1 - pct / 100)

  function applyFilter(key: string, value: string) {
    const sp = new URLSearchParams()
    if (key !== 'status'  && filters.status)  sp.set('status',  filters.status)
    if (key !== 'commune' && filters.commune) sp.set('commune', filters.commune)
    if (key !== 'q'       && filters.q)       sp.set('q',       filters.q)
    if (value) sp.set(key, value)
    startTransition(() => router.push(`/prospectos/${campaign.id}?${sp.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilter('q', search)
  }

  const statuses: (ProspectStatus | '')[] = ['', 'new', 'following', 'quoting', 'closed_won', 'closed_lost']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/prospectos" className="text-sm text-gray-400 hover:text-gray-600">← Campañas</Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-sm text-gray-500">{prospects.length} prospectos en vista actual</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/prospectos/${campaign.id}/importar`}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            ↑ Importar CSV
          </Link>
          <Link href={`/prospectos/${campaign.id}/nuevo`}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
            style={{ background: '#1B8A4B' }}>
            + Agregar prospecto
          </Link>
        </div>
      </div>

      {/* Meta diaria */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 mb-5">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="#e5e7eb" strokeWidth="6"/>
          <circle cx="32" cy="32" r="27" fill="none"
            stroke={pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : '#2563eb'}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 32 32)"/>
          <text x="32" y="29" textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">{todayContacted}</text>
          <text x="32" y="39" textAnchor="middle" fontSize="8" fill="#6b7280">/ {DAILY_GOAL}</text>
        </svg>
        <div className="flex-1">
          <p className="font-bold text-gray-900">Meta diaria</p>
          <p className="text-sm text-gray-500">
            <strong className="text-green-600">{todayContacted} gestionados</strong> hoy ·{' '}
            {Math.max(0, DAILY_GOAL - todayContacted)} pendientes para la meta
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">✓ {todayContacted} realizados</span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{campaign.total_prospects} total</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar colegio..."
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:border-blue-400"
          />
          <button type="submit" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">🔍</button>
        </form>

        <select
          value={filters.commune ?? ''}
          onChange={e => applyFilter('commune', e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none">
          <option value="">Todas las comunas</option>
          {communes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex gap-1">
          {statuses.map(s => (
            <button key={s}
              onClick={() => applyFilter('status', s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                (filters.status ?? '') === s
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === '' ? 'Todos' : STATUS_LABELS[s as ProspectStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {prospects.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <p>No hay prospectos con estos filtros</p>
          </div>
        )}
        {prospects.map((p, i) => (
          <Link key={p.id} href={`/prospectos/${campaign.id}/${p.id}`}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-sm hover:border-blue-300 transition-all">
            <span className="text-sm font-bold text-gray-300 min-w-[24px] text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{p.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {p.commune && <span>{p.commune} · </span>}
                {p.contacts && p.contacts[0] && (
                  <span>{p.contacts[0].role}: {p.contacts[0].name}</span>
                )}
              </p>
              <div className="flex gap-2 mt-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                  {STATUS_LABELS[p.status]}
                </span>
                {p.activity_count! > 0 && (
                  <span className="text-xs text-gray-400">{p.activity_count} gestiones</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <DaysChip prospect={p} />
              {p.assigned_name && (
                <p className="text-xs text-gray-400 mt-1">{p.assigned_name}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm hover:bg-green-50 hover:border-green-300 cursor-pointer">📞</span>
              <span className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer">💬</span>
              <span className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm hover:bg-gray-50 cursor-pointer">✉️</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
