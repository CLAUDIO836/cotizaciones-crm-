'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Props {
  quotationId: string
  currentTab: string
  activitiesCount: number
  notesCount: number
}

const TABS = [
  { key: 'datos',     label: 'Datos' },
  { key: 'items',     label: 'Ítems' },
  { key: 'gestiones', label: 'Gestiones' },
  { key: 'notas',     label: 'Notas' },
]

export default function QuotationTabs({ quotationId, currentTab, activitiesCount, notesCount }: Props) {
  const badges: Record<string, number> = {
    gestiones: activitiesCount,
    notas: notesCount,
  }

  return (
    <div className="bg-white border-b px-6 flex items-center gap-0.5">
      {TABS.map(tab => {
        const isActive = currentTab === tab.key
        const badge = badges[tab.key]
        return (
          <Link
            key={tab.key}
            href={`/cotizaciones/${quotationId}?tab=${tab.key}`}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
            style={isActive
              ? { borderColor: '#1B8A4B', color: '#1B8A4B' }
              : { borderColor: 'transparent', color: '#6b7280' }
            }
          >
            {tab.label}
            {badge != null && badge > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={isActive
                  ? { background: '#1B8A4B', color: 'white' }
                  : { background: '#f3f4f6', color: '#6b7280' }
                }
              >
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
