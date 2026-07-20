import Link from 'next/link'
import { formatCLP } from '@/lib/utils'

interface Quotation {
  id: string
  number: string
  status: string
  client_name: string | null
  total: number | null
  issue_date: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open:  { label: 'Abierta',  color: 'bg-blue-100 text-blue-700' },
  won:   { label: 'Ganada',   color: 'bg-green-100 text-green-700' },
  lost:  { label: 'Perdida',  color: 'bg-red-100 text-red-700' },
}

export default function MisNegociosRecientes({ quotations }: { quotations: Quotation[] }) {
  if (quotations.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Mis negocios recientes</h2>
        <p className="text-sm text-gray-400 text-center py-6">No hay negocios aún.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Mis negocios recientes</h2>
        <Link href="/cotizaciones" className="text-sm text-green-700 hover:underline font-medium">
          Ver todos
        </Link>
      </div>
      <div className="divide-y">
        {quotations.map(q => {
          const st = STATUS_LABEL[q.status] ?? { label: q.status, color: 'bg-gray-100 text-gray-600' }
          return (
            <Link
              key={q.id}
              href={`/cotizaciones/${q.id}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-5 px-5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-green-700 shrink-0">{q.number}</span>
                <span className="text-sm text-gray-700 truncate">{q.client_name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                  {st.label}
                </span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatCLP(q.total ?? 0)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
