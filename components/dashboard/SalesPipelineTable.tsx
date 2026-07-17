import { formatCLP } from '@/lib/utils'

interface VendedorRow {
  name: string
  open: number
  won: number
  lost: number
  total: number
}

export default function SalesPipelineTable({ data }: { data: VendedorRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium text-gray-500">Vendedor</th>
            <th className="text-center py-2 font-medium text-blue-600">Abiertas</th>
            <th className="text-center py-2 font-medium text-green-600">Ganadas</th>
            <th className="text-center py-2 font-medium text-red-500">Perdidas</th>
            <th className="text-right py-2 font-medium text-gray-500">Monto ganado</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.name} className="border-b last:border-0">
              <td className="py-2.5 font-medium text-gray-900">{row.name}</td>
              <td className="py-2.5 text-center text-blue-700">{row.open}</td>
              <td className="py-2.5 text-center text-green-700">{row.won}</td>
              <td className="py-2.5 text-center text-red-600">{row.lost}</td>
              <td className="py-2.5 text-right text-gray-700">{formatCLP(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
