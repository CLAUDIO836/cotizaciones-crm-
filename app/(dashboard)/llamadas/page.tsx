import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, getToken } from '@/lib/api'
import { Phone, ExternalLink } from 'lucide-react'

interface CallRow {
  id: string
  user_id: string
  executive_name: string
  to_number: string
  called_at: string
  called_at_cl?: string
  contact_id: string | null
  contact_name: string | null
  prospect_id: string | null
  prospect_company: string | null
}

const CRM_API = 'https://www.transccl.cl/crm-api.php'

function formatNumber(n: string) {
  const d = n.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('56')) {
    return `+56 ${d[2]} ${d.slice(3, 7)} ${d.slice(7)}`
  }
  return n
}

function formatTime(dt?: string | null) {
  if (!dt) return { date: '—', time: '' }
  const parts = dt.split(' ')
  const dateParts = (parts[0] ?? '').split('-')
  if (dateParts.length < 3) return { date: dt, time: '' }
  return { date: `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`, time: parts[1]?.slice(0, 5) ?? '' }
}

export default async function LlamadasPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const token = await getToken()

  let calls: CallRow[] = []
  let errorMsg = ''

  try {
    const url = `${CRM_API}?action=outbound_calls_list&limit=100`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const json = await res.json()
    calls = Array.isArray(json.data) ? json.data : []
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Error cargando llamadas'
  }

  const known   = calls.filter(c => c.contact_id)
  const unknown = calls.filter(c => !c.contact_id)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#1B8A4B' }}>
          <Phone className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Historial de llamadas</h1>
          <p className="text-sm text-gray-500">Llamadas realizadas desde el CRM</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{errorMsg}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{calls.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total llamadas</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#1B8A4B' }}>{known.length}</div>
          <div className="text-xs text-gray-500 mt-1">Contactos conocidos</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{unknown.length}</div>
          <div className="text-xs text-gray-500 mt-1">Números externos</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ejecutivo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Número marcado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto / Empresa</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay llamadas registradas aún
                </td>
              </tr>
            )}
            {calls.map(c => {
              const { date, time } = formatTime(c.called_at_cl ?? c.called_at)
              const isKnown = !!c.contact_id
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-800">{date}</div>
                    <div className="text-xs text-gray-500">{time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: '#1B8A4B' }}>
                        {(c.executive_name ?? '?')[0]}
                      </div>
                      <span className="text-gray-700">{c.executive_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-800">
                    {formatNumber(c.to_number)}
                  </td>
                  <td className="px-4 py-3">
                    {isKnown ? (
                      <Link href={`/prospectos/${c.prospect_id}`}
                        className="group flex items-center gap-1.5 hover:underline">
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-green-700">
                            {c.contact_name}
                          </div>
                          {c.prospect_company && (
                            <div className="text-xs text-gray-500">{c.prospect_company}</div>
                          )}
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-green-600 flex-shrink-0" />
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1.5 text-orange-500">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="text-xs">Número externo</span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
