'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function HerramientasAdmin() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

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
    </div>
  )
}
