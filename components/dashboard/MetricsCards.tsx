import { formatCLP } from '@/lib/utils'
import { FileText, TrendingUp, Target } from 'lucide-react'

interface Props {
  openCount: number
  wonThisMonth: number
  conversionRate: number
}

export default function MetricsCards({ openCount, wonThisMonth, conversionRate }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#e8faf2' }}>
          <FileText className="w-5 h-5" style={{ color: '#1B8A4B' }} />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-0.5">Cotizaciones abiertas</p>
          <p className="text-3xl font-bold text-gray-900">{openCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#e8faf2' }}>
          <TrendingUp className="w-5 h-5" style={{ color: '#1B8A4B' }} />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-0.5">Ganado este mes</p>
          <p className="text-3xl font-bold text-gray-900">{formatCLP(wonThisMonth)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#f0fdf4' }}>
          <Target className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-0.5">Tasa de conversión</p>
          <p className="text-3xl font-bold text-gray-900">{conversionRate}%</p>
        </div>
      </div>
    </div>
  )
}
