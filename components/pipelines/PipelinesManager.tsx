'use client'

import { useState } from 'react'
// supabase replaced by internal API routes
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, GripVertical } from 'lucide-react'

interface Pipeline {
  id: string
  name: string
  color: string
  active: boolean
  sort_order: number
}

const COLORS = [
  '#FF6C37', '#3b82f6', '#16a34a', '#9333ea',
  '#f59e0b', '#ec4899', '#14b8a6', '#6366f1',
]

export default function PipelinesManager({ initialPipelines }: { initialPipelines: Pipeline[] }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(initialPipelines)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Pipeline | null>(null)
  const [form, setForm] = useState({ name: '', color: '#FF6C37' })
  const [loading, setLoading] = useState(false)

  function openNew() {
    setEditing(null)
    setForm({ name: '', color: '#FF6C37' })
    setOpen(true)
  }

  function openEdit(p: Pipeline) {
    setEditing(p)
    setForm({ name: p.name, color: p.color })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setLoading(true)
    try {
      const body = editing
        ? { id: editing.id, name: form.name.trim(), color: form.color }
        : { name: form.name.trim(), color: form.color }
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      if (editing) {
        setPipelines(prev => prev.map(p => p.id === editing.id ? { ...p, ...body } : p))
        toast.success('Embudo actualizado')
      } else {
        setPipelines(prev => [...prev, data])
        toast.success('Embudo creado')
      }
      setOpen(false)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(p: Pipeline) {
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, name: p.name, color: p.color, active: !p.active, sort_order: p.sort_order }),
    })
    if (!res.ok) { toast.error('Error'); return }
    setPipelines(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} style={{ background: 'var(--pipe-orange)', border: 'none' }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo embudo
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {pipelines.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No hay embudos creados</div>
        ) : (
          pipelines.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: p.color }}
              />
              <span className="flex-1 font-medium text-gray-900">{p.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {p.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(p)}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {p.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar embudo' : 'Nuevo embudo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Servicios diarios"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: form.color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={loading} style={{ background: 'var(--pipe-orange)', border: 'none' }}>
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
