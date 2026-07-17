import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCLP, formatDate, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContractStatusUpdate from '@/components/contracts/ContractStatusUpdate'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('contracts')
    .select('*, clients(name, rut, email), profiles(name), quotations(number)')
    .eq('id', id)
    .single()

  if (!c) notFound()

  const { label, color } = getStatusLabel(c.status)

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/contratos" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{c.number}</h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
              {label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Creado: {formatDate(c.created_at)}
            {c.profiles?.name && ` · Vendedor: ${c.profiles.name}`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-700">Detalles</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Cliente</p>
            <p className="font-medium text-gray-900">{c.clients?.name ?? '—'}</p>
            {c.clients?.rut && <p className="text-gray-500 text-xs">RUT: {c.clients.rut}</p>}
          </div>
          <div>
            <p className="text-gray-500">Cotización origen</p>
            <p className="font-medium text-gray-900">{c.quotations?.number ?? 'Sin cotización'}</p>
          </div>
          <div>
            <p className="text-gray-500">Fecha inicio</p>
            <p className="font-medium text-gray-900">{formatDate(c.start_date)}</p>
          </div>
          <div>
            <p className="text-gray-500">Fecha término</p>
            <p className="font-medium text-gray-900">{c.end_date ? formatDate(c.end_date) : 'Sin término'}</p>
          </div>
          <div>
            <p className="text-gray-500">Valor</p>
            <p className="font-bold text-gray-900 text-lg">{formatCLP(c.value)}</p>
          </div>
        </div>
        {c.notes && (
          <div>
            <p className="text-gray-500 text-sm">Notas</p>
            <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">{c.notes}</p>
          </div>
        )}
      </div>

      {c.status === 'active' && <ContractStatusUpdate contractId={c.id} />}
    </div>
  )
}
