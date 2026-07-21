import { getSession, fetchQuotationsSummary, fetchProfiles } from '@/lib/api'
import { formatCLP, getMonthName } from '@/lib/utils'
import MetricsCards from '@/components/dashboard/MetricsCards'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import SalesPipelineTable from '@/components/dashboard/SalesPipelineTable'

export default async function DashboardPage() {
  const user = await getSession()
  const isAdmin = user?.role === 'admin'
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const startDate = new Date(currentYear, now.getMonth() - 11, 1).toISOString().split('T')[0]

  const [quotations, profiles] = await Promise.all([
    fetchQuotationsSummary({ start: startDate }),
    isAdmin ? fetchProfiles() : Promise.resolve([]),
  ])

  const thisMonth = quotations.filter(q => q.year === currentYear && q.month === currentMonth)
  const openCount = quotations.filter(q => q.status === 'open').length
  const wonThisMonth = thisMonth.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0)
  const total = thisMonth.length
  const wonCount = thisMonth.filter(q => q.status === 'won').length
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, now.getMonth() - (5 - i), 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const mq = quotations.filter(q => q.year === y && q.month === m)
    return {
      month: getMonthName(m).slice(0, 3),
      ganadas: mq.filter(q => q.status === 'won').length,
      perdidas: mq.filter(q => q.status === 'lost').length,
      abiertas: mq.filter(q => q.status === 'open').length,
      monto: mq.filter(q => q.status === 'won').reduce((s, q) => s + (q.total ?? 0), 0),
    }
  })

  let vendedoresData: { name: string; open: number; won: number; lost: number; total: number }[] = []
  if (isAdmin) {
    vendedoresData = profiles.map(p => {
      const pq = quotations.filter(q => q.vendedor_id === p.id)
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
        <p className="text-sm text-gray-500 mt-1">{getMonthName(currentMonth)} {currentYear}</p>
      </div>
      <MetricsCards openCount={openCount} wonThisMonth={wonThisMonth} conversionRate={conversionRate} />
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
      </div>
    </div>
  )
}
