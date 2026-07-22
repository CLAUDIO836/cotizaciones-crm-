'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, AlertTriangle, Trash2, ChevronDown, ChevronRight, Phone, Mail, User } from 'lucide-react'
import { formatRut, validateRut, rutKey, autoFormatRut } from '@/lib/rut'

interface Contact {
  id: string
  name: string
  email?: string
  phone_mobile?: string
  phone_landline?: string
  cargo?: string
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
  const [dupClient, setDupClient] = useState<{ id: string; name: string; rut: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [mergingId, setMergingId] = useState<string | null>(null)

  // Expandable contacts
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({})
  const [loadingContacts, setLoadingContacts] = useState<string | null>(null)

  // New contact form
  const [showNewContact, setShowNewContact] = useState<string | null>(null)
  const [newContact, setNewContact] = useState({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Edit contact
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editContactClientId, setEditContactClientId] = useState<string | null>(null)
  const [editContactForm, setEditContactForm] = useState({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
  const [savingEditContact, setSavingEditContact] = useState(false)

  async function toggleExpand(clientId: string) {
    if (expandedId === clientId) {
      setExpandedId(null)
      return
    }
    setExpandedId(clientId)
    if (contacts[clientId]) return
    setLoadingContacts(clientId)
    try {
      const res = await fetch(`/api/clients?id=${clientId}`)
      const json = await res.json()
      const data = json.data ?? json
      const list: Contact[] = data?.contacts ?? []
      setContacts(prev => ({ ...prev, [clientId]: list }))
    } catch {
      setContacts(prev => ({ ...prev, [clientId]: [] }))
    } finally {
      setLoadingContacts(null)
    }
  }

  async function saveNewContact(clientId: string) {
    if (!newContact.name.trim()) { toast.error('El nombre es requerido'); return }
    setSavingContact(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'create_contact',
          client_id: clientId,
          name: newContact.name.trim(),
          cargo: newContact.cargo || null,
          phone_mobile: newContact.phone_mobile || null,
          phone_landline: newContact.phone_landline || null,
          email: newContact.email || null,
        }),
      })
      const json = await res.json()
      const data = json.data ?? null
      if (!res.ok || !data) throw new Error(json.error ?? 'Error')
      setContacts(prev => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), data] }))
      setNewContact({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
      setShowNewContact(null)
      toast.success('Contacto agregado')
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setSavingContact(false)
    }
  }

  function openEditContact(clientId: string, c: Contact) {
    setEditingContact(c)
    setEditContactClientId(clientId)
    setEditContactForm({
      name: c.name,
      cargo: c.cargo ?? '',
      phone_mobile: c.phone_mobile ?? '',
      phone_landline: c.phone_landline ?? '',
      email: c.email ?? '',
    })
  }

  async function saveEditContact() {
    if (!editingContact || !editContactClientId) return
    setSavingEditContact(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'update_contact',
          id: editingContact.id,
          client_id: editContactClientId,
          name: editContactForm.name.trim(),
          cargo: editContactForm.cargo || null,
          phone_mobile: editContactForm.phone_mobile || null,
          phone_landline: editContactForm.phone_landline || null,
          email: editContactForm.email || null,
        }),
      })
      if (!res.ok) throw new Error('Error')
      const updated: Contact = { ...editingContact, ...editContactForm }
      setContacts(prev => ({
        ...prev,
        [editContactClientId]: (prev[editContactClientId] ?? []).map(c => c.id === editingContact.id ? updated : c),
      }))
      setEditingContact(null)
      setEditContactClientId(null)
      toast.success('Contacto actualizado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingEditContact(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', rut: '', email: '', phone: '', address: '' })
    setRutError('')
    setDupClient(null)
    setOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, rut: c.rut ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' })
    setRutError('')
    setDupClient(null)
    setOpen(true)
  }

  function handleRutChange(value: string) {
    const formatted = autoFormatRut(value)
    setForm(f => ({ ...f, rut: formatted }))
    setDupClient(null)
    if (!formatted.trim()) { setRutError(''); return }
    if (!validateRut(formatted)) { setRutError('RUT inválido — revisa el dígito verificador'); return }
    // Verificar duplicado local (en memoria) antes de ir al backend
    const dup = clients.find(c => c.rut && rutKey(c.rut) === rutKey(formatted) && c.id !== editing?.id)
    if (dup) {
      setRutError(`RUT ya registrado para "${dup.name}"`)
      setDupClient({ id: dup.id, name: dup.name, rut: dup.rut ?? '' })
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
    if (form.rut.trim() && !validateRut(form.rut)) { toast.error('El RUT ingresado no es válido — revisa el dígito verificador'); return }
    if (rutError) { toast.error(rutError); return }
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
      const json = await res.json()

      if (res.status === 422) {
        setRutError('RUT inválido — dígito verificador incorrecto')
        toast.error('RUT inválido')
        return
      }
      if (res.status === 409) {
        const ec = json.existing_client
        setDupClient(ec ?? null)
        setRutError(`RUT ya registrado para "${ec?.name ?? 'otro cliente'}"`)
        toast.error('RUT duplicado')
        return
      }
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')

      if (editing) {
        setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...payload } as Client : c))
        toast.success('Cliente actualizado')
      } else {
        setClients(prev => [...prev, json.data ?? json as Client].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Cliente creado')
      }
      setOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const rutCount: Record<string, number> = {}
  for (const c of clients) {
    if (c.rut) {
      const k = rutKey(c.rut)
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
              <th className="w-8 px-2 py-3"></th>
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
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No hay clientes registrados
                </td>
              </tr>
            ) : (
              clients.map(c => {
                const isDup = c.rut ? duplicateRuts.has(rutKey(c.rut)) : false
                const isExpanded = expandedId === c.id
                const clientContacts = contacts[c.id] ?? []

                return (
                  <>
                    <tr
                      key={c.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      style={isDup ? { background: '#fff1f2' } : undefined}
                      onClick={() => toggleExpand(c.id)}
                    >
                      <td className="px-2 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {c.name}
                          {isDup && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600"><AlertTriangle className="w-3 h-3" />Duplicado</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.rut ? formatRut(c.rut) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isDup ? (
                            (() => {
                              const keepClient = clients.find(o => o.id !== c.id && o.rut && rutKey(o.rut) === rutKey(c.rut ?? ''))
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

                    {/* Expanded contacts row */}
                    {isExpanded && (
                      <tr key={`${c.id}-contacts`} className="bg-gray-50 border-b">
                        <td></td>
                        <td colSpan={5} className="px-6 py-4">
                          {loadingContacts === c.id ? (
                            <p className="text-sm text-gray-400">Cargando contactos...</p>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contactos</p>
                              {clientContacts.length === 0 && showNewContact !== c.id && (
                                <p className="text-sm text-gray-400 italic">Sin contactos registrados</p>
                              )}
                              {clientContacts.map(contact => (
                                <div key={contact.id} className="flex items-start justify-between bg-white rounded-lg border px-4 py-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="font-medium text-sm text-gray-800">{contact.name}</span>
                                      {contact.cargo && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{contact.cargo}</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-4 ml-5">
                                      {contact.phone_mobile && (
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                          <Phone className="w-3 h-3" /> {contact.phone_mobile}
                                        </span>
                                      )}
                                      {contact.phone_landline && (
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                          <Phone className="w-3 h-3" /> {contact.phone_landline}
                                        </span>
                                      )}
                                      {contact.email && (
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                          <Mail className="w-3 h-3" /> {contact.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    className="text-gray-300 hover:text-blue-500 ml-4"
                                    onClick={() => openEditContact(c.id, contact)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}

                              {/* New contact inline form */}
                              {showNewContact === c.id ? (
                                <div className="bg-white border border-dashed border-blue-300 rounded-lg p-4 space-y-2">
                                  <p className="text-xs font-semibold text-gray-600">Nuevo contacto</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input placeholder="Nombre *" value={newContact.name}
                                      onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} className="text-sm" />
                                    <Input placeholder="Cargo" value={newContact.cargo}
                                      onChange={e => setNewContact(p => ({ ...p, cargo: e.target.value }))} className="text-sm" />
                                    <Input placeholder="Celular" value={newContact.phone_mobile}
                                      onChange={e => setNewContact(p => ({ ...p, phone_mobile: e.target.value }))} className="text-sm" />
                                    <Input placeholder="Teléfono fijo" value={newContact.phone_landline}
                                      onChange={e => setNewContact(p => ({ ...p, phone_landline: e.target.value }))} className="text-sm" />
                                    <Input placeholder="Email" value={newContact.email}
                                      onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="text-sm col-span-2" />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" disabled={savingContact} onClick={() => saveNewContact(c.id)}>
                                      {savingContact ? 'Guardando...' : 'Guardar contacto'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                      setShowNewContact(null)
                                      setNewContact({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
                                    }}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
                                  onClick={() => setShowNewContact(c.id)}
                                >
                                  <Plus className="w-4 h-4" />
                                  Agregar contacto
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit client dialog */}
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
              {rutError && !dupClient && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {rutError}
                </div>
              )}
              {dupClient && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Este RUT ya está registrado
                  </div>
                  <p>
                    <span className="font-medium">{dupClient.name}</span>
                    {dupClient.rut ? <span className="text-red-500 ml-1">({formatRut(dupClient.rut)})</span> : null}
                  </p>
                  <a
                    href={`/clientes?highlight=${dupClient.id}`}
                    className="inline-flex items-center gap-1 underline font-medium hover:text-red-900"
                    onClick={() => setOpen(false)}
                  >
                    Abrir cliente existente →
                  </a>
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

      {/* Edit contact dialog */}
      <Dialog open={!!editingContact} onOpenChange={v => { if (!v) { setEditingContact(null); setEditContactClientId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={editContactForm.name} onChange={e => setEditContactForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={editContactForm.cargo} onChange={e => setEditContactForm(f => ({ ...f, cargo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Celular</Label>
                <Input value={editContactForm.phone_mobile} onChange={e => setEditContactForm(f => ({ ...f, phone_mobile: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono fijo</Label>
                <Input value={editContactForm.phone_landline} onChange={e => setEditContactForm(f => ({ ...f, phone_landline: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editContactForm.email} onChange={e => setEditContactForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={saveEditContact} disabled={savingEditContact}>
                {savingEditContact ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={() => { setEditingContact(null); setEditContactClientId(null) }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
