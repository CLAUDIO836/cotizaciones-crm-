'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Client { id: string; name: string }

export default function ContractForm({ clients, userId }: { clients: Client[]; userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [value, setValue] = useState(0)
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { toast.error('Selecciona un cliente'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          user_id: userId,
          start_date: startDate,
          end_date: endDate || null,
          value,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Contrato creado exitosamente')
      router.push('/contratos')
    } catch {
      toast.error('Error al crear el contrato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
      <div className="space-y-1.5">
        <Label>Cliente *</Label>
        <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fecha inicio *</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha término</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Valor del contrato (CLP) *</Label>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={e => setValue(parseFloat(e.target.value) || 0)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Crear contrato'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
