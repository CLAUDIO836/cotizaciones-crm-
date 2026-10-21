import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, getToken } from '@/lib/api'
import { Phone, PhoneIncoming, PhoneOutgoing, ExternalLink } from 'lucide-react'

interface CallRow {
  id: string
  executive_name: string
  to_number: string
  called_at: string
  called_at_cl?: string
  direction: 'outbound' | 'inbound'
  duration_sec: number | null
  recording_url: string | null
  contact_id: string | null
  contact_name: string | null
  prospect_id: string | null
  prospect_company: string | null
}

const CRM_API = 'https://www.transccl.cl/crm-api.php'

function formatNumber(n: string) {
  const d = n.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('56')) return `+56 ${d[2]} ${d.slice(3,7)} ${d.slice(7)}`
  if (d.length === 9) return `+56 ${d[0]} ${d.slice(1,5)} ${d.slice(5)}`
  return n
}

function formatDuration(sec: number | null) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

function formatTime(dt?: string | null) {
  if (!dt) return { date: '—', time: '' }
  const [date, time] = dt.split(' ')
  const [y, m, d] = (date ?? '').split('-')
  if (!d) return { date: dt, time: '' }
  return { date: `${d}/${m}/${y}`, time: time?.slice(0,5) ?? '' }
}

export default async function LlamadasPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const token = await getToken()

  let calls: CallRow[] = []
  let errorMsg = ''

  try {
    const res = await fetch(`${CRM_API}?action=outbound_calls_list&limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const json = await res.json()
    calls = Array.isArray(json.data) ? json.data : []
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Error cargando llamadas'
  }

  const outbound = calls.filter(c => c.direction !== 'inbound')
  const inbound  = calls.filter(c => c.direction === 'inbound')
  const known    = calls.filter(c => c.contact_id)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: '#1B8A4B' }}>
          <Phone className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Historial de llamadas</h1>
          <p className="text-sm text-gray-500">Llamadas realizadas y recibidas desde el CRM</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{errorMsg}</div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{calls.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{outbound.length}</div>
          <div className="text-xs text-gray-500 mt-1">Salientes</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{inbound.length}</div>
          <div className="text-xs text-gray-500 mt-1">Entrantes</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#1B8A4B' }}>{known.length}</div>
          <div className="text-xs text-gray-500 mt-1">Conocidos</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ejecutivo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto / Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">Duración</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Grabación</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay llamadas registradas aún
                </td>
              </tr>
            )}
            {calls.map(c => {
              const { date, time } = formatTime(c.called_at_cl ?? c.called_at)
              const isIn = c.direction === 'inbound'
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-800">{date}</div>
                    <div className="text-xs text-gray-500">{time}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${isIn ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {isIn
                          ? <PhoneIncoming className="w-3 h-3" />
                          : <PhoneOutgoing className="w-3 h-3" />}
                      </div>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: '#1B8A4B' }}>
                        {(c.executive_name ?? '?')[0]}
                      </div>
                      <span className="text-gray-700 text-xs">{c.executive_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">
                    {formatNumber(c.to_number)}
                  </td>
                  <td className="px-4 py-3">
                    {c.contact_id ? (
                      <Link href={`/prospectos/${c.prospect_id}`}
                        className="group flex items-center gap-1 hover:underline">
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-green-700 text-xs">{c.contact_name}</div>
                          {c.prospect_company && <div className="text-xs text-gray-400">{c.prospect_company}</div>}
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-green-600 flex-shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-xs text-orange-400">Número externo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    {formatDuration(c.duration_sec) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.recording_url ? (
                      <audio controls className="h-7 w-24" src={c.recording_url} />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
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
