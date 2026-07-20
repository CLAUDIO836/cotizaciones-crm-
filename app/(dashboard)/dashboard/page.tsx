import { createClient } from '@/lib/supabase/server'
import { formatCLP, getMonthName } from '@/lib/utils'
import MetricsCards from '@/components/dashboard/MetricsCards'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import SalesPipelineTable from '@/components/dashboard/SalesPipelineTable'
import MisNegociosRecientes from '@/components/dashboard/MisNegociosRecientes'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const isAdmin = profile?.role === 'admin'
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Traer cotizaciones de los últimos 12 meses
  const startDate = new Date(currentYear, now.getMonth() - 11, 1).toISOString().split('T')[0]

  let query = supabase
    .from('quotations_summary')
    .select('*')
    .gte('issue_date', startDate)

  if (!isAdmin) {
    query = query.eq('vendedor_id', user!.id)
  }

  const { data: quotations = [] } = await query

  // Métricas del mes actual
  const thisMonth = (quotations ?? []).filter(q => q.year === currentYear && q.month === currentMonth)
  const openCount = (quotations ?? []).filter(q => q.status === 'open').length
  const wonThisMonth = thisMonth.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0)
  const total = thisMonth.length
  const wonCount = thisMonth.filter(q => q.status === 'won').length
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0

  // Datos para gráfico por mes (últimos 6 meses)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, now.getMonth() - (5 - i), 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const monthQuotes = (quotations ?? []).filter(q => q.year === y && q.month === m)
    return {
      month: getMonthName(m).slice(0, 3),
      ganadas: monthQuotes.filter(q => q.status === 'won').length,
      perdidas: monthQuotes.filter(q => q.status === 'lost').length,
      abiertas: monthQuotes.filter(q => q.status === 'open').length,
      monto: monthQuotes.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0),
    }
  })

  // Últimas 8 cotizaciones del vendedor (para no-admin)
  const recentQuotations = !isAdmin
    ? [...(quotations ?? [])]
        .sort((a, b) => new Date(b.created_at ?? b.issue_date).getTime() - new Date(a.created_at ?? a.issue_date).getTime())
        .slice(0, 8)
    : []

  // Resumen por vendedor (solo admin)
  let vendedoresData: { name: string; open: number; won: number; lost: number; total: number }[] = []
  if (isAdmin) {
    const { data: profiles } = await supabase.from('profiles').select('id, name')
    vendedoresData = (profiles ?? []).map(p => {
      const pq = (quotations ?? []).filter(q => q.vendedor_id === p.id)
      return {
        name: p.name,
        open: pq.filter(q => q.status === 'open').length,
        won: pq.filter(q => q.status === 'won').length,
        lost: pq.filter(q => q.status === 'lost').length,
        total: pq.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0),
      }
    }).filter(v => v.open + v.won + v.lost > 0)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {getMonthName(currentMonth)} {currentYear}
        </p>
      </div>

      <MetricsCards
        openCount={openCount}
        wonThisMonth={wonThisMonth}
        conversionRate={conversionRate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Últimos 6 meses</h2>
          <MonthlyChart data={monthlyData} />
        </div>

        {isAdmin && vendedoresData.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Resumen por vendedor</h2>
            <SalesPipelineTable data={vendedoresData} />
          </div>
        )}

        {!isAdmin && (
          <MisNegociosRecientes quotations={recentQuotations} />
        )}
      </div>
    </div>
  )
}
