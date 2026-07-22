'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CrmQuotation {
  number: string
  pipedrive_deal_id: string
  status: string
  total: number
}

export default function HerramientasAdmin() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [recoverResult, setRecoverResult] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [crmQuotations, setCrmQuotations] = useState<CrmQuotation[] | null>(null)

  async function runImport() {
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/import-contacts', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      const data = d.data ?? d
      const msg = `✓ ${data.fixed_client_id ?? 0} enlaces corregidos · ${data.total_contacts ?? '?'} contactos total · ${data.clients_with_contacts ?? '?'}/${data.clients_total ?? '?'} clientes con contacto`
      setResult(msg)
      toast.success('Verificación completa')
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setImporting(false)
    }
  }

  async function runRestore() {
    if (!confirm('¿Restaurar client_id de todas las cotizaciones desde el backup del 21-Jul-2026?')) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const res = await fetch('/api/admin/restore-clients', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      const data = d.data ?? d
      const dist = (data.distribucion_actual ?? []).map((r: {client_name: string, total: number}) => `${r.client_name}: ${r.total}`).join(' · ')
      setRestoreResult(`✓ ${data.client_ids_restaurados} cotizaciones restauradas → ${dist}`)
      toast.success('¡Datos restaurados!')
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setRestoring(false)
    }
  }

  async function runSyncCheck() {
    setSyncing(true)
    setCrmQuotations(null)
    try {
      const res = await fetch('/api/admin/import-contacts?action=quotations_summary')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      const quotes: CrmQuotation[] = d.data ?? []
      setCrmQuotations(quotes)
      toast.success(`${quotes.length} cotizaciones en CRM`)
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setSyncing(false)
    }
  }

  async function runRecover() {
    if (!confirm('¿Recuperar clientes de cotizaciones consultando Pipedrive?')) return
    setRecovering(true)
    setRecoverResult(null)
    try {
      const res = await fetch('/api/admin/recover-from-pipedrive', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      const data = d.data ?? d
      const dist = (data.distribucion ?? []).map((r: {client_name: string, total: number}) => `${r.client_name}: ${r.total}`).join(' · ')
      const noFound = (data.no_encontradas ?? []).join(', ')
      setRecoverResult(`✓ ${data.restauradas} restauradas${noFound ? ` · No encontradas: ${noFound}` : ''} → ${dist}`)
      toast.success('¡Recuperación desde Pipedrive completa!')
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Importar contactos desde cotizaciones</h2>
        <p className="text-sm text-gray-500">
          Lee todos los nombres de contacto guardados en cotizaciones existentes y los crea en la tabla de contactos del cliente correspondiente. Solo importa contactos que aún no existen — es seguro correr varias veces.
        </p>
        {result && (
          <div className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            {result}
          </div>
        )}
        <Button onClick={runImport} disabled={importing}>
          {importing ? 'Importando...' : 'Ejecutar importación'}
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-blue-800">Recuperar clientes desde Pipedrive</h2>
        <p className="text-sm text-blue-600">
          Consulta Pipedrive para obtener la organización de cada cotización y restaurar el cliente correcto. Usar cuando los negocios aparecen todos con el mismo cliente.
        </p>
        {recoverResult && (
          <div className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 break-words">
            {recoverResult}
          </div>
        )}
        <Button onClick={runRecover} disabled={recovering} className="bg-blue-600 hover:bg-blue-700 text-white">
          {recovering ? 'Recuperando desde Pipedrive...' : 'Recuperar desde Pipedrive'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Cotizaciones en CRM</h2>
          <Button onClick={runSyncCheck} disabled={syncing} variant="outline" size="sm">
            {syncing ? 'Cargando...' : 'Ver cotizaciones'}
          </Button>
        </div>
        {crmQuotations !== null && (
          crmQuotations.length === 0
            ? <p className="text-sm text-gray-500">No hay cotizaciones en el CRM.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">N°</th>
                      <th className="pb-2 pr-4">Deal PD</th>
                      <th className="pb-2 pr-4">Estado</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmQuotations.map((q) => (
                      <tr key={q.number} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono font-medium">{q.number}</td>
                        <td className="py-2 pr-4 text-gray-500">{q.pipedrive_deal_id || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            q.status === 'won' ? 'bg-green-100 text-green-700' :
                            q.status === 'lost' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{q.status}</span>
                        </td>
                        <td className="py-2 text-right font-mono">
                          {q.total ? `$${q.total.toLocaleString('es-CL')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-red-800">Restaurar clientes de cotizaciones (backup 21-Jul-2026)</h2>
        <p className="text-sm text-red-600">
          Restaura el campo <code>client_id</code> de todas las cotizaciones al valor que tenía antes. Usa solo si los negocios aparecen todos con el mismo cliente.
        </p>
        {restoreResult && (
          <div className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            {restoreResult}
          </div>
        )}
        <Button onClick={runRestore} disabled={restoring} variant="destructive">
          {restoring ? 'Restaurando...' : 'Restaurar client_id desde backup'}
        </Button>
      </div>
    </div>
  )
}
