'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Edit2, Check, X } from 'lucide-react'

interface Profile {
  id: string; name: string; role: string; created_at?: string
  celular?: string; email?: string
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-red-100 text-red-700',
  admin:      'bg-purple-100 text-purple-700',
  vendedor:   'bg-blue-100 text-blue-700',
  ejecutivo:  'bg-blue-100 text-blue-700',
  coordinador:'bg-gray-100 text-gray-700',
}
const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin', admin: 'Admin',
  vendedor: 'Ejecutivo', ejecutivo: 'Ejecutivo', coordinador: 'Coordinador',
}

export default function UsersManager({ users: initialUsers }: { users: Profile[] }) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ celular: '', email: '' })
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'vendedor', celular: '' })

  async function createUser() {
    if (!form.email || !form.password || !form.name) { toast.error('Completa todos los campos'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, role: form.role }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      // Guardar celular si se ingresó
      if (form.celular && result.profile?.id) {
        await fetch('/api/admin/usuarios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: result.profile.id, celular: form.celular, email: form.email }),
        })
        result.profile.celular = form.celular
        result.profile.email = form.email
      }

      setUsers(prev => [...prev, result.profile].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Usuario creado exitosamente')
      setOpen(false)
      setForm({ email: '', password: '', name: '', role: 'vendedor', celular: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  async function updateRole(userId: string, role: string | null) {
    if (!role) return
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role }),
    })
    if (!res.ok) { toast.error('Error al actualizar rol') }
    else { setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u)); toast.success('Rol actualizado') }
  }

  function startEdit(u: Profile) {
    setEditingId(u.id)
    setEditForm({ celular: u.celular ?? '', email: u.email ?? '' })
  }

  async function saveEdit(userId: string) {
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, celular: editForm.celular || null, email: editForm.email || null }),
    })
    if (!res.ok) { toast.error('Error al guardar') }
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...editForm } : u))
      setEditingId(null)
      toast.success('Datos actualizados')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} style={{ background: '#1B8A4B' }} className="text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto ejecutivo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0"
                      style={{ background: '#1B8A4B' }}>
                      {u.name[0]}
                    </div>
                    <span className="font-medium text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Celular"
                        value={editForm.celular}
                        onChange={e => setEditForm(f => ({ ...f, celular: e.target.value }))}
                        className="h-7 text-xs w-32"
                      />
                      <Input
                        placeholder="Email"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="h-7 text-xs w-44"
                      />
                      <button onClick={() => saveEdit(u.id)} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 leading-relaxed">
                      {u.celular && <div>📱 {u.celular}</div>}
                      {u.email && <div>✉ {u.email}</div>}
                      {!u.celular && !u.email && <span className="text-gray-300">—</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select value={u.role} onValueChange={v => updateRole(u.id, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="vendedor">Ejecutivo</SelectItem>
                      <SelectItem value="coordinador">Coordinador</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  {editingId !== u.id && (
                    <button onClick={() => startEdit(u)} className="text-gray-300 hover:text-gray-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear usuario */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@transccl.cl" />
            </div>
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <Input value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} placeholder="9 1234 5678" />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v ?? 'vendedor' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="vendedor">Ejecutivo</SelectItem>
                  <SelectItem value="coordinador">Coordinador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={createUser} disabled={loading} style={{ background: '#1B8A4B' }} className="text-white">
                {loading ? 'Creando...' : 'Crear usuario'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
