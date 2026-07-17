'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { formatCLP, formatDate, getStatusLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye } from 'lucide-react'

interface Quotation {
  id: string
  number: string
  status: string
  issue_date: string
  expiry_date?: string
  total: number
  client_name?: string
  vendedor_name?: string
  vendedor_id?: string
}

interface Vendedor { id: string; name: string }

interface Props {
  quotations: Quotation[]
  vendedores: Vendedor[]
  isAdmin: boolean
  currentFilters: { status?: string; month?: string; vendedor?: string; q?: string }
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'open', label: 'Abiertas' },
  { value: 'won', label: 'Ganadas' },
  { value: 'lost', label: 'Perdidas' },
]

export default function QuotationsList({ quotations, vendedores, isAdmin, currentFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams()
    const current = { ...currentFilters, [key]: (!value || value === 'all') ? '' : value }
    Object.entries(current).forEach(([k, v]) => { if (v) params.set(k, v) })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por N° o cliente..."
          defaultValue={currentFilters.q}
          onChange={e => updateFilter('q', e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={currentFilters.status || 'all'}
          onValueChange={v => updateFilter('status', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select
            value={currentFilters.vendedor || 'all'}
            onValueChange={v => updateFilter('vendedor', v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <input
          type="month"
          value={currentFilters.month || ''}
          onChange={e => updateFilter('month', e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">N°</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
              {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-500">Vendedor</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Emisión</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Vencimiento</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-gray-400">
                  No se encontraron cotizaciones
                </td>
              </tr>
            ) : (
              quotations.map(q => {
                const { label, color } = getStatusLabel(q.status)
                return (
                  <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{q.number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{q.client_name ?? '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-600">{q.vendedor_name ?? '—'}</td>}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(q.issue_date)}</td>
                    <td className="px-4 py-3 text-gray-500">{q.expiry_date ? formatDate(q.expiry_date) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCLP(q.total)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/cotizaciones/${q.id}`} className="text-blue-600 hover:text-blue-800">
                        <Eye className="w-4 h-4" />
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
