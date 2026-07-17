import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCLP, getMonthName } from '@/lib/utils'
import ReportesCharts from '@/components/dashboard/ReportesCharts'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  if (!isAdmin) redirect('/dashboard')

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0]

  const { data: quotations = [] } = await supabase
    .from('quotations_summary')
    .select('*')
    .gte('issue_date', startDate)

  const { data: profiles = [] } = await supabase.from('profiles').select('id, name')

  const qs = quotations ?? []

  // KPIs globales
  const totalGanado = qs.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0)
  const totalPendiente = qs.filter(q => q.status === 'open').reduce((s, q) => s + (q.total ?? 0), 0)
  const totalPerdido = qs.filter(q => q.status === 'lost').reduce((s, q) => s + (q.total ?? 0), 0)
  const conversion = qs.length > 0 ? Math.round((qs.filter(q => q.status === 'won').length / qs.length) * 100) : 0

  // Por mes (últimos 12)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const mq = qs.filter(q => q.year === y && q.month === m)
    return {
      label: getMonthName(m).slice(0, 3),
      ganado: mq.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0),
      pendiente: mq.filter(q => q.status === 'open').reduce((s, q) => s + (q.total ?? 0), 0),
      perdido: mq.filter(q => q.status === 'lost').reduce((s, q) => s + (q.total ?? 0), 0),
    }
  })

  // Por ejecutivo
  const ejecutivoData = (profiles ?? []).map(p => {
    const pq = qs.filter(q => q.vendedor_id === p.id)
    return {
      name: p.name,
      ganado: pq.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0),
      pendiente: pq.filter(q => q.status === 'open').reduce((s, q) => s + (q.total ?? 0), 0),
      perdido: pq.filter(q => q.status === 'lost').reduce((s, q) => s + (q.total ?? 0), 0),
      total: pq.length,
      tasa: pq.length > 0 ? Math.round((pq.filter(q => q.status === 'won').length / pq.length) * 100) : 0,
    }
  }).filter(e => e.total > 0).sort((a, b) => b.ganado - a.ganado)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">Últimos 12 meses</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total ganado', value: formatCLP(totalGanado), color: '#1B8A4B', bg: '#f0fdf4' },
          { label: 'En negociación', value: formatCLP(totalPendiente), color: '#0ea5e9', bg: '#f0f9ff' },
          { label: 'Total perdido', value: formatCLP(totalPerdido), color: '#D33A2C', bg: '#fef2f2' },
          { label: 'Conversión', value: `${conversion}%`, color: '#F2B705', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <ReportesCharts monthlyData={monthlyData} ejecutivoData={ejecutivoData} />

      {/* Tabla ejecutivos */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Detalle por ejecutivo</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ejecutivo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Negociaciones</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-green-700">Ganado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Pendiente</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: '#D33A2C' }}>Perdido</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Conversión</th>
            </tr>
          </thead>
          <tbody>
            {ejecutivoData.map(e => (
              <tr key={e.name} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase"
                      style={{ background: '#1B8A4B' }}
                    >
                      {e.name[0]}
                    </div>
                    {e.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{e.total}</td>
                <td className="px-4 py-3 text-right font-medium" style={{ color: '#1B8A4B' }}>{formatCLP(e.ganado)}</td>
                <td className="px-4 py-3 text-right text-blue-600">{formatCLP(e.pendiente)}</td>
                <td className="px-4 py-3 text-right" style={{ color: '#D33A2C' }}>{formatCLP(e.perdido)}</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={e.tasa >= 50
                      ? { background: '#f0fdf4', color: '#1B8A4B' }
                      : { background: '#fef2f2', color: '#D33A2C' }
                    }
                  >
                    {e.tasa}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
