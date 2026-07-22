'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function HerramientasAdmin() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [recoverResult, setRecoverResult] = useState<string | null>(null)

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
