import { getSession, fetchContracts } from '@/lib/api'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCLP, formatDate, getStatusLabel } from '@/lib/utils'

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const user = await getSession()
  const isAdmin = user?.role === 'admin'
  const filters: Record<string, string> = {}
  if (params.status) filters.status = params.status
  const contracts = await fetchContracts(filters)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contracts?.length ?? 0} contratos</p>
        </div>
        <Link href="/contratos/nuevo">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo contrato
          </Button>
        </Link>
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'Todos' },
          { value: 'active', label: 'Activos' },
          { value: 'expired', label: 'Vencidos' },
          { value: 'cancelled', label: 'Cancelados' },
        ].map(opt => (
          <Link
            key={opt.value}
            href={opt.value ? `/contratos?status=${opt.value}` : '/contratos'}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              (params.status || '') === opt.value
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">N°</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
              {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-500">Cotización</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Inicio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Término</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(contracts).length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-gray-400">
                  No se encontraron contratos
                </td>
              </tr>
            ) : (
              (contracts).map((c: {
                id: string
                number: string
                status: string
                start_date?: string
                end_date?: string
                value: number
                clients?: { name: string; rut?: string }
                profiles?: { name: string }
                quotations?: { number: string }
              }) => {
                const { label, color } = getStatusLabel(c.status)
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{c.number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.clients?.name ?? '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-600">{c.profiles?.name ?? '—'}</td>}
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{c.quotations?.number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.start_date ? formatDate(c.start_date) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.end_date ? formatDate(c.end_date) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCLP(c.value)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/contratos/${c.id}`} className="text-blue-600 hover:text-blue-800 text-xs">
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
