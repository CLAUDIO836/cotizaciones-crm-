'use client'
import Link from 'next/link'
import { Campaign } from '@/lib/prospectos-types'

const SEGMENT_LABELS: Record<string, string> = {
  educacional: '🏫 Educacional',
  corporativo: '🏢 Corporativo',
  otro:        '📋 Otro',
}

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  draft:   'bg-gray-100 text-gray-600',
  paused:  'bg-yellow-100 text-yellow-700',
  closed:  'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Activa', draft: 'Borrador', paused: 'Pausada', closed: 'Cerrada',
}

export default function CampaignsList({ campaigns, isAdmin }: { campaigns: Campaign[], isAdmin: boolean }) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-3">📋</div>
        <p className="font-medium">No hay campañas aún</p>
        {isAdmin && <p className="text-sm mt-1">Crea la primera campaña para comenzar</p>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map(c => {
        const pct = c.total_prospects > 0
          ? Math.round((c.contacted_count / c.total_prospects) * 100)
          : 0
        return (
          <Link key={c.id} href={`/prospectos/${c.id}`}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all block">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{SEGMENT_LABELS[c.segment] ?? c.segment} · {c.region}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
              <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mb-3">{pct}% contactados — {c.contacted_count} / {c.total_prospects}</p>

            <div className="flex gap-4 text-xs text-gray-500">
              <span>Prospectos: <strong className="text-gray-800">{c.total_prospects}</strong></span>
              <span>Cotizando: <strong className="text-gray-800">{c.quoting_count}</strong></span>
            </div>
          </Link>
        )
      })}

      {isAdmin && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[140px] text-gray-400 cursor-pointer hover:border-gray-300">
          <span className="text-3xl">📁</span>
          <span className="text-sm font-medium">Subir nueva base</span>
          <span className="text-xs">Excel o CSV</span>
        </div>
      )}
    </div>
  )
}
