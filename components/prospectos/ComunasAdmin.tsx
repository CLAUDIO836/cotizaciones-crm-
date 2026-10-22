'use client'
import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Campaign, CommuneAssignment } from '@/lib/prospectos-types'

export default function ComunasAdmin({
  campaigns, selectedCampaignId, assignments, communes, profiles,
}: {
  campaigns: Campaign[]
  selectedCampaignId: string | null
  assignments: CommuneAssignment[]
  communes: string[]
  profiles: { id: string; name: string; email: string; role: string }[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)
  const [filterCommune, setFilterCommune] = useState('')
  const [filterUser, setFilterUser] = useState('')

  const vendedores = profiles.filter(p => p.role !== 'coordinador')
  const assignmentMap = Object.fromEntries(assignments.map(a => [a.commune, a]))

  const filteredCommunes = useMemo(() => {
    return communes.filter(commune => {
      if (filterCommune && !commune.toLowerCase().includes(filterCommune.toLowerCase())) return false
      if (filterUser) {
        const cur = assignmentMap[commune]
        if (!cur || cur.user_id !== filterUser) return false
      }
      return true
    })
  }, [communes, filterCommune, filterUser, assignmentMap])

  const hasFilters = filterCommune || filterUser

  function changeCampaign(id: string) {
    startTransition(() => router.push(`/prospectos/admin?campaign_id=${id}`))
  }

  async function saveAssignment(commune: string, userId: string) {
    setSaving(commune)
    try {
      await fetch('/api/prospectos/commune-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: selectedCampaignId, commune, user_id: userId }),
      })
      startTransition(() => router.refresh())
    } finally {
      setSaving(null)
    }
  }

  async function deleteAssignment(commune: string) {
    setSaving(commune)
    try {
      await fetch('/api/prospectos/commune-assignment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: selectedCampaignId, commune }),
      })
      startTransition(() => router.refresh())
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/prospectos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← Campañas</Link>
          <h1 className="text-xl font-bold text-gray-900">⚙ Asignación de Comunas</h1>
          <p className="text-sm text-gray-500">Define qué ejecutivo atiende cada comuna. Las excepciones individuales tienen prioridad.</p>
        </div>
      </div>

      {/* Selector campaña */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <label className="text-sm font-semibold text-gray-700 block mb-2">Campaña</label>
        <div className="flex gap-2 flex-wrap">
          {campaigns.map(c => (
            <button key={c.id}
              onClick={() => changeCampaign(c.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                c.id === selectedCampaignId
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={c.id === selectedCampaignId ? { background: '#1B8A4B' } : {}}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {!selectedCampaignId ? (
        <p className="text-gray-400 text-center py-12">Selecciona una campaña</p>
      ) : communes.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No hay comunas en esta campaña. Importa prospectos primero.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-sm">
                {filteredCommunes.length === communes.length ? communes.length : `${filteredCommunes.length} de ${communes.length}`} comunas
              </span>
              <span className="text-xs text-gray-400">
                {assignments.length} asignadas · {communes.length - assignments.length} sin asignar
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar comuna..."
                  value={filterCommune}
                  onChange={e => setFilterCommune(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">Todos los encargados</option>
                {vendedores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {hasFilters && (
                <button onClick={() => { setFilterCommune(''); setFilterUser('') }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredCommunes.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-8">Sin resultados para los filtros aplicados</p>
            )}
            {filteredCommunes.map(commune => {
              const current = assignmentMap[commune]
              return (
                <div key={commune} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{commune}</p>
                    {current && (
                      <p className="text-xs text-gray-400 mt-0.5">{current.user_email}</p>
                    )}
                  </div>
                  <select
                    value={current?.user_id ?? ''}
                    onChange={e => {
                      if (e.target.value) saveAssignment(commune, e.target.value)
                      else deleteAssignment(commune)
                    }}
                    disabled={saving === commune}
                    className={`px-3 py-1.5 text-sm border rounded-lg focus:outline-none transition-all ${
                      current ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}>
                    <option value="">Sin asignar</option>
                    {vendedores.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {saving === commune && (
                    <span className="text-xs text-gray-400">Guardando...</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info excepciones */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
        <strong>Excepciones individuales:</strong> Si un colegio específico debe ser atendido por un ejecutivo distinto al de su comuna, puedes cambiarlo directamente desde la ficha del prospecto. La excepción siempre tiene prioridad sobre esta regla de comuna.
      </div>
    </div>
  )
}
