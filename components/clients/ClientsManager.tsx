'use client'

import { useState } from 'react'
// supabase replaced by internal API routes
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Plus, Pencil, AlertTriangle, Trash2 } from 'lucide-react'
import { formatRUT } from '@/lib/utils'

function validateRUT(rut: string): boolean {
  const clean = rut.replace(/[.\-\s]/g, '').toUpperCase()
  if (clean.length < 2) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false
  const num = parseInt(body, 10)
  if (num < 1000000 || num > 99999999) return false
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const calc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === calc
}

function normalizeRUT(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase()
}

interface Client {
  id: string
  name: string
  rut?: string
  email?: string
  phone?: string
  address?: string
}

export default function ClientsManager({ initialClients }: { initialClients: Client[] }) {

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', rut: '', email: '', phone: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [rutError, setRutError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [mergingId, setMergingId] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setForm({ name: '', rut: '', email: '', phone: '', address: '' })
    setRutError('')
    setOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, rut: c.rut ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' })
    setRutError('')
    setOpen(true)
  }

  function handleRutChange(value: string) {
    setForm(f => ({ ...f, rut: value }))
    if (!value.trim()) { setRutError(''); return }
    if (!validateRUT(value)) {
      setRutError('RUT inválido')
      return
    }
    const normalized = normalizeRUT(value)
    const duplicate = clients.find(c => c.rut && normalizeRUT(c.rut) === normalized && c.id !== editing?.id)
    if (duplicate) {
      setRutError(`RUT ya registrado para "${duplicate.name}"`)
    } else {
      setRutError('')
    }
  }

  async function handleMergeDelete(deleteId: string, keepId: string) {
    setMergingId(deleteId)
    try {
      const res = await fetch('/api/clients/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_id: keepId, delete_id: deleteId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      setClients(prev => prev.filter(c => c.id !== deleteId))
      toast.success(`Duplicado eliminado — ${d.reassigned} cotización(es) reasignadas`)
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setMergingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Cliente eliminado')
    } catch {
      toast.error('No se pudo eliminar — puede tener cotizaciones asociadas')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (rutError) { toast.error(rutError); return }
    if (form.rut.trim() && !validateRUT(form.rut)) { toast.error('El RUT ingresado no es válido'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        rut: form.rut.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      }
      const body = editing ? { ...payload, id: editing.id } : payload
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      if (editing) {
        setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...payload } as Client : c))
        toast.success('Cliente actualizado')
      } else {
        setClients(prev => [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Cliente creado')
      }
      setOpen(false)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // Detectar RUTs duplicados
  const rutCount: Record<string, number> = {}
  for (const c of clients) {
    if (c.rut) {
      const k = normalizeRUT(c.rut)
      rutCount[k] = (rutCount[k] ?? 0) + 1
    }
  }
  const duplicateRuts = new Set(Object.entries(rutCount).filter(([, n]) => n > 1).map(([k]) => k))
  const duplicateCount = duplicateRuts.size

  return (
    <div className="space-y-4">
      {duplicateCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{duplicateCount} RUT{duplicateCount > 1 ? 's' : ''} duplicado{duplicateCount > 1 ? 's' : ''}</strong> — elimina los registros duplicados para mantener la base de datos limpia.</span>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo cliente
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">RUT</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Teléfono</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  No hay clientes registrados
                </td>
              </tr>
            ) : (
              clients.map(c => {
                const isDup = c.rut ? duplicateRuts.has(normalizeRUT(c.rut)) : false
                return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50"
                  style={isDup ? { background: '#fff1f2' } : undefined}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {c.name}
                      {isDup && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600"><AlertTriangle className="w-3 h-3" />Duplicado</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.rut ? formatRUT(c.rut) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isDup ? (
                        (() => {
                          const keepClient = clients.find(o => o.id !== c.id && o.rut && normalizeRUT(o.rut) === normalizeRUT(c.rut ?? ''))
                          return keepClient ? (
                            <button
                              onClick={() => handleMergeDelete(c.id, keepClient.id)}
                              disabled={mergingId === c.id}
                              className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              {mergingId === c.id ? 'Eliminando...' : 'Eliminar duplicado'}
                            </button>
                          ) : null
                        })()
                      ) : confirmDeleteId === c.id ? (
                        <span className="flex items-center gap-1 text-xs">
                          <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                            className="text-red-600 font-bold hover:underline">
                            {deletingId === c.id ? '...' : 'Sí, eliminar'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 hover:underline ml-1">
                            No
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(c.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                )})
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input
                value={form.rut}
                onChange={e => handleRutChange(e.target.value)}
                placeholder="76.000.000-0"
                className={rutError ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {rutError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {rutError}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
