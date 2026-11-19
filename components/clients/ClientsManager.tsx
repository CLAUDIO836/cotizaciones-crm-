'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, AlertTriangle, Trash2, ChevronDown, ChevronRight, Phone, Mail, User, Search, X, History, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import { formatRut, validateRut, rutKey, autoFormatRut } from '@/lib/rut'
import { validateChileanPhone, autoFormatPhone, phoneError, PHONE_DEFAULT_MOBILE } from '@/lib/phone'

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
  tipo?: 'natural' | 'empresa' | 'colegio' | null
  medio_pago?: string | null
}

interface HistoryItem {
  id: string
  number?: string
  pipedrive_deal_id?: string
  status: 'open' | 'won' | 'lost'
  pipeline_name?: string
  total: number
  issue_date?: string
  fecha_salida?: string
  desde?: string
  hasta?: string
  vendedor_name?: string
  client_name?: string
  client_rut?: string
  created_at?: string
}


export default function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', rut: '', email: '', phone: '', address: '', tipo: '' as '' | 'natural' | 'empresa' | 'colegio', medio_pago: '' })
  const [tipoFilter, setTipoFilter] = useState<'' | 'natural' | 'empresa' | 'colegio'>('')
  const [loading, setLoading] = useState(false)
  const [rutError, setRutError] = useState('')
  const [dupClient, setDupClient] = useState<{ id: string; name: string; rut: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Expandable contacts
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Record<string, Contact[]>>({})
  const [loadingContacts, setLoadingContacts] = useState<string | null>(null)

  // New contact form
  const [showNewContact, setShowNewContact] = useState<string | null>(null)
  const [newContact, setNewContact] = useState({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
  const [savingContact, setSavingContact] = useState(false)

  // History
  const [history, setHistory] = useState<Record<string, HistoryItem[]>>({})
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, 'contactos' | 'historia'>>({})

  // Edit contact
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editContactClientId, setEditContactClientId] = useState<string | null>(null)
  const [editContactForm, setEditContactForm] = useState({ name: '', cargo: '', phone_mobile: '', phone_landline: '', email: '' })
  const [savingEditContact, setSavingEditContact] = useState(false)

  const searchParams = useSearchParams()
  useEffect(() => {
    const openId = searchParams.get('open')
    const tab = searchParams.get('tab') as 'contactos' | 'historia' | null
    if (!openId) return
    setExpandedId(openId)
    if (tab === 'historia') {
      setActiveTab(prev => ({ ...prev, [openId]: 'historia' }))
      if (!history[openId]) {
        setLoadingHistory(openId)
        fetch(`/api/clients/history?client_id=${openId}`)
          .then(r => r.json())
          .then((json: { data?: HistoryItem[] }) => {
            setHistory(prev => ({ ...prev, [openId]: json.data ?? [] }))
          })
          .catch(() => setHistory(prev => ({ ...prev, [openId]: [] })))
          .finally(() => setLoadingHistory(null))
      }
    } else {
      setActiveTab(prev => ({ ...prev, [openId]: 'contactos' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleExpand(clientId: string) {
    if (expandedId === clientId) {
      setExpandedId(null)
      return
    }
    setExpandedId(clientId)
    const tab = activeTab[clientId] ?? 'contactos'
    if (tab === 'contactos' && !contacts[clientId]) {
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
    } else if (tab === 'historia') {
      loadHistory(clientId)
    }
  }

  async function loadHistory(clientId: string) {
    if (history[clientId]) return
    setLoadingHistory(clientId)
    try {
      const res = await fetch(`/api/clients/history?client_id=${clientId}`)
      const json = await res.json()
      setHistory(prev => ({ ...prev, [clientId]: json.data ?? [] }))
    } catch {
      setHistory(prev => ({ ...prev, [clientId]: [] }))
    } finally {
      setLoadingHistory(null)
    }
  }

  function switchTab(clientId: string, tab: 'contactos' | 'historia') {
    setActiveTab(prev => ({ ...prev, [clientId]: tab }))
    if (tab === 'historia') loadHistory(clientId)
    if (tab === 'contactos' && !contacts[clientId]) {
      setLoadingContacts(clientId)
      fetch(`/api/clients?id=${clientId}`)
        .then(r => r.ok ? r.json() : { contacts: [] })
        .then((json: { data?: { contacts?: Contact[] }; contacts?: Contact[] }) => {
          const data = json.data ?? json
          setContacts(prev => ({ ...prev, [clientId]: data?.contacts ?? [] }))
        })
        .catch(() => setContacts(prev => ({ ...prev, [clientId]: [] })))
        .finally(() => setLoadingContacts(null))
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
    setForm({ name: '', rut: '', email: '', phone: PHONE_DEFAULT_MOBILE, address: '', tipo: '', medio_pago: '' })
    setRutError('')
    setDupClient(null)
    setOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, rut: c.rut ? formatRut(c.rut) : '', email: c.email ?? '', phone: c.phone || PHONE_DEFAULT_MOBILE, address: c.address ?? '', tipo: c.tipo ?? '', medio_pago: c.medio_pago ?? '' })
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
    const nameTrimmed = form.name.trim()
    if (!nameTrimmed) { toast.error('El nombre es requerido'); return }

    // RUT obligatorio
    if (!form.rut.trim()) { toast.error('El RUT es obligatorio'); return }
    if (!validateRut(form.rut)) { toast.error('El RUT ingresado no es válido — revisa el dígito verificador'); return }
    if (rutError) { toast.error(rutError); return }

    // Tipo obligatorio
    if (!form.tipo) { toast.error('Selecciona el tipo de cliente (Natural, Empresa o Colegio)'); return }

    // Medio de pago obligatorio
    if (!form.medio_pago) { toast.error('Selecciona el medio de pago del cliente'); return }

    // Persona natural: al menos nombre y apellido
    if (form.tipo === 'natural' && nameTrimmed.split(/\s+/).filter(Boolean).length < 2) {
      toast.error('Para persona natural ingresa al menos nombre y apellido'); return
    }

    // Teléfono obligatorio y formato chileno
    const phoneErr = phoneError(form.phone)
    if (phoneErr) { toast.error(phoneErr); return }

    setLoading(true)
    try {
      const payload = {
        name: nameTrimmed,
        rut: form.rut.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        tipo: form.tipo || null,
        medio_pago: form.medio_pago || null,
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
        setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...payload, tipo: (payload.tipo as Client['tipo']) ?? c.tipo, medio_pago: payload.medio_pago } as Client : c))
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

  const searchLower = search.trim().toLowerCase()
  const searchRutKey = searchLower ? rutKey(search) : ''
  const filtered = clients.filter(c => {
    const matchSearch = !searchLower ||
      c.name.toLowerCase().includes(searchLower) ||
      (c.rut && rutKey(c.rut).includes(searchRutKey))
    const matchTipo = !tipoFilter || c.tipo === tipoFilter
    return matchSearch && matchTipo
  })

  return (
    <div className="space-y-4">
      {duplicateCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{duplicateCount} RUT{duplicateCount > 1 ? 's' : ''} duplicado{duplicateCount > 1 ? 's' : ''}</strong> — elimina los registros duplicados para mantener la base de datos limpia.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {([['', 'Todos'], ['natural', 'Natural'], ['empresa', 'Empresa'], ['colegio', 'Colegio']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setTipoFilter(v)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
              style={tipoFilter === v
                ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' }
                : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 whitespace-nowrap">
          {filtered.length} de {clients.length}
        </p>
        <Button onClick={openNew} className="ml-auto">
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No hay resultados para &ldquo;{search}&rdquo;
                </td>
              </tr>
            ) : (
              filtered.map(c => {
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.name}
                          {c.tipo === 'natural' && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">Natural</span>}
                          {c.tipo === 'empresa' && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">Empresa</span>}
                          {c.tipo === 'colegio' && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">Colegio</span>}
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

                    {/* Expanded row with tabs */}
                    {isExpanded && (
                      <tr key={`${c.id}-contacts`} className="bg-gray-50 border-b">
                        <td></td>
                        <td colSpan={5} className="px-6 py-4">
                          {/* Tab switcher */}
                          <div className="flex gap-1 mb-4 border-b border-gray-200">
                            {(['contactos', 'historia'] as const).map(tab => (
                              <button
                                key={tab}
                                onClick={e => { e.stopPropagation(); switchTab(c.id, tab) }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-px"
                                style={
                                  (activeTab[c.id] ?? 'contactos') === tab
                                    ? { borderColor: '#1B8A4B', color: '#1B8A4B' }
                                    : { borderColor: 'transparent', color: '#9CA3AF' }
                                }
                              >
                                {tab === 'contactos' ? <User className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
                                {tab === 'contactos' ? 'Contactos' : 'Historia Comercial'}
                              </button>
                            ))}
                          </div>

                          {/* CONTACTOS TAB */}
                          {(activeTab[c.id] ?? 'contactos') === 'contactos' && (
                          loadingContacts === c.id ? (
                            <p className="text-sm text-gray-400">Cargando contactos...</p>
                          ) : (
                            <div className="space-y-3">
                              {/* hidden label since tabs already show the section */}
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
                          ))}

                          {/* HISTORIA COMERCIAL TAB */}
                          {(activeTab[c.id] ?? 'contactos') === 'historia' && (() => {
                            const hist = history[c.id] ?? []
                            const abiertas = hist.filter(h => h.status === 'open')
                            const ganadas  = hist.filter(h => h.status === 'won')
                            const perdidas = hist.filter(h => h.status === 'lost')
                            const sum = (arr: HistoryItem[]) => arr.reduce((s, h) => s + Number(h.total ?? 0), 0)
                            const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`
                            return (
                              <div className="space-y-2">
                                {loadingHistory === c.id ? (
                                  <p className="text-sm text-gray-400">Cargando historia...</p>
                                ) : hist.length === 0 ? (
                                  <p className="text-sm text-gray-400 italic">Sin negocios registrados para este cliente</p>
                                ) : (
                                  <>
                                    {/* Resumen por estado */}
                                    <div className="flex flex-wrap gap-3 mb-3">
                                      {abiertas.length > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                                          <span className="text-xs font-semibold text-amber-700">{abiertas.length} Abierta{abiertas.length !== 1 ? 's' : ''}</span>
                                          <span className="text-xs text-amber-600">{fmt(sum(abiertas))}</span>
                                        </div>
                                      )}
                                      {ganadas.length > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                          <span className="text-xs font-semibold text-green-700">{ganadas.length} Ganada{ganadas.length !== 1 ? 's' : ''}</span>
                                          <span className="text-xs text-green-600">{fmt(sum(ganadas))}</span>
                                        </div>
                                      )}
                                      {perdidas.length > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
                                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                                          <span className="text-xs font-semibold text-red-600">{perdidas.length} Perdida{perdidas.length !== 1 ? 's' : ''}</span>
                                          <span className="text-xs text-red-500">{fmt(sum(perdidas))}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-1.5">
                                      {hist.map(h => {
                                        const num = h.number ?? h.pipedrive_deal_id ?? h.id.slice(0, 8)
                                        // Fecha del servicio (mes de embudo); fallback a created_at
                                        const rawDate = h.fecha_salida ?? h.issue_date ?? h.created_at ?? ''
                                        const dateObj = rawDate ? new Date(new Date(rawDate).getTime() + 3 * 60 * 60 * 1000) : null
                                        const mesAnio = dateObj ? dateObj.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }) : '—'
                                        const amount = h.total ? fmt(Number(h.total)) : '—'
                                        const rut = h.client_rut ?? c.rut
                                        const statusLabel = h.status === 'won' ? 'Ganado' : h.status === 'lost' ? 'Perdido' : 'Abierto'
                                        const statusStyle = h.status === 'won'
                                          ? 'bg-green-50 text-green-700 border-green-200'
                                          : h.status === 'lost'
                                          ? 'bg-red-50 text-red-600 border-red-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                        return (
                                          <div key={h.id} className="flex items-center gap-3 bg-white rounded-lg border px-4 py-2.5 hover:border-gray-300 transition-colors">
                                            {/* Número de cotización como link */}
                                            <a
                                              href={`/cotizaciones/${h.id}`}
                                              onClick={e => e.stopPropagation()}
                                              className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0 flex items-center gap-1"
                                            >
                                              #{num}
                                              <ExternalLink className="w-3 h-3 opacity-50" />
                                            </a>
                                            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                              {/* Estado */}
                                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle}`}>
                                                {statusLabel}
                                              </span>
                                              {/* Pipeline */}
                                              {h.pipeline_name && (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[140px]">{h.pipeline_name}</span>
                                              )}
                                              {/* RUT · nombre · mes */}
                                              <span className="text-xs text-gray-400 hidden sm:inline">
                                                {rut && <span className="font-mono">{rut}</span>}
                                                {rut && ' · '}
                                                {(h.client_name ?? c.name)}
                                              </span>
                                              {/* Mes del servicio */}
                                              <span className="text-xs text-gray-400 capitalize">{mesAnio}</span>
                                              {h.vendedor_name && (
                                                <span className="text-xs text-gray-400 hidden md:inline">· {h.vendedor_name}</span>
                                              )}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{amount}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })()}
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
              <Label>
                {form.tipo === 'natural' ? 'Nombre y apellido *' : 'Razón social *'}
              </Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                placeholder={form.tipo === 'natural' ? 'JUAN PÉREZ González' : 'EMPRESA S.A.'}
                style={{ textTransform: 'uppercase' }}
              />
              {form.tipo === 'natural' && form.name.trim() && form.name.trim().split(/\s+/).filter(Boolean).length < 2 && (
                <p className="text-xs text-amber-600">Ingresa al menos nombre y apellido</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>RUT *</Label>
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
              <Label>Teléfono *</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: autoFormatPhone(e.target.value) }))}
                placeholder="+56 9 XXXX XXXX"
                className={form.phone && !validateChileanPhone(form.phone) ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {form.phone && !validateChileanPhone(form.phone) && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Usa +569XXXXXXXX (celular) o +562XXXXXXXX (fijo)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de cliente *</Label>
              <div className="flex gap-2 flex-wrap">
                {([['natural', 'Persona Natural'], ['empresa', 'Empresa'], ['colegio', 'Colegio / Institución']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, tipo: v }))}
                    className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                    style={form.tipo === v
                      ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' }
                      : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Medio de pago *</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  ['', 'Sin definir'],
                  ['al_contado', 'Contado — 1 pago total'],
                  ['cincuenta_cincuenta', 'Contado — 50% + 50%'],
                  ['credito_7', 'Crédito 7 días'],
                  ['credito_15', 'Crédito 15 días'],
                  ['credito_30', 'Crédito 30 días'],
                  ['credito_60', 'Crédito 60 días'],
                ] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, medio_pago: v }))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-xs transition-all"
                    style={form.medio_pago === v
                      ? { borderColor: '#1B8A4B', background: '#f0fdf4', color: '#14532d', fontWeight: 600 }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }}>
                    <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: form.medio_pago === v ? '#1B8A4B' : '#d1d5db' }}>
                      {form.medio_pago === v && <div className="w-1.5 h-1.5 rounded-full bg-green-700" />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
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
