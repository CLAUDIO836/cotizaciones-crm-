'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Phone, Mail, Plus, User, Building2, Check } from 'lucide-react'

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
  address?: string
  contacts: Contact[]
}

interface Props {
  onSelect: (clientId: string, contactId: string | null) => void
}

export default function ClientRutSearch({ onSelect }: Props) {
  const [rut, setRut] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Nuevo cliente
  const [newClientName, setNewClientName] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientMobile, setNewClientMobile] = useState('')
  const [newClientLandline, setNewClientLandline] = useState('')
  const [newClientContactName, setNewClientContactName] = useState('')
  const [newClientContactCargo, setNewClientContactCargo] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  // Nuevo contacto
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactMobile, setNewContactMobile] = useState('')
  const [newContactLandline, setNewContactLandline] = useState('')
  const [newContactCargo, setNewContactCargo] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  function formatRut(value: string) {
    const clean = value.replace(/[^0-9kK]/g, '')
    if (clean.length <= 1) return clean
    const body = clean.slice(0, -1)
    const dv = clean.slice(-1)
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv.toUpperCase()
  }

  async function searchByRut(rawRut: string) {
    if (rawRut.length < 3) { setClient(null); setNotFound(false); return }
    setSearching(true)
    const res = await fetch(`/api/clients?rut=${encodeURIComponent(rawRut.replace(/\./g, ''))}`)
    const json = await res.json()
    const data = json.data ?? null

    if (data) {
      const contacts = data.contacts ?? []
      setClient({ ...data, contacts })
      setNotFound(false)
      setShowNewClient(false)
      if (contacts.length === 1) {
        setSelectedContactId(contacts[0].id)
        onSelect(data.id, contacts[0].id)
      } else {
        setSelectedContactId(null)
        onSelect(data.id, null)
      }
    } else {
      setClient(null)
      setNotFound(true)
      setShowNewClient(true)
      setNewClientName('')
    }
    setSearching(false)
  }

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatRut(e.target.value)
    setRut(formatted)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => searchByRut(formatted), 600)
  }

  function selectContact(contact: Contact) {
    setSelectedContactId(contact.id)
    onSelect(client!.id, contact.id)
    setShowNewContact(false)
  }

  async function saveNewClient() {
    if (!newClientName.trim()) return
    if (!newClientMobile.trim() && !newClientLandline.trim()) { alert('Ingresa al menos un teléfono'); return }
    if (!newClientEmail.trim()) { alert('El email es obligatorio'); return }
    if (!newClientContactName.trim()) { alert('Ingresa el nombre del contacto'); return }
    setSavingClient(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newClientName.trim(),
        rut: rut || null,
        address: newClientAddress || null,
        email: newClientEmail || null,
        telefono_celular: newClientMobile || null,
        telefono_fijo: newClientLandline || null,
        contacto: newClientContactName || null,
      }),
    })
    const json = await res.json()
    const data = json.data ?? null
    setSavingClient(false)
    if (!res.ok || !data) return
    // crear contacto automáticamente
    const resC = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'create_contact',
        client_id: data.id,
        name: newClientContactName.trim(),
        cargo: newClientContactCargo || null,
        email: newClientEmail || null,
        phone_mobile: newClientMobile || null,
        phone_landline: newClientLandline || null,
      }),
    })
    const contactData = (await resC.json()).data ?? null
    const contacts = contactData ? [contactData] : []
    setClient({ ...data, contacts })
    setNotFound(false)
    setShowNewClient(false)
    if (contactData) {
      setSelectedContactId(contactData.id)
      onSelect(data.id, contactData.id)
    } else {
      setShowNewContact(true)
      onSelect(data.id, null)
    }
  }

  async function saveNewContact() {
    if (!newContactName.trim() || !client) return
    setSavingContact(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'create_contact',
        client_id: client.id,
        name: newContactName.trim(),
        email: newContactEmail || null,
        phone_mobile: newContactMobile || null,
        phone_landline: newContactLandline || null,
        cargo: newContactCargo || null,
      }),
    })
    const json = await res.json()
    const data = json.data ?? null
    if (!res.ok || !data) { setSavingContact(false); return }
    const updated = { ...client, contacts: [...client.contacts, data] }
    setClient(updated)
    setSelectedContactId(data.id)
    onSelect(client.id, data.id)
    setShowNewContact(false)
    setNewContactName(''); setNewContactEmail(''); setNewContactMobile('')
    setNewContactLandline(''); setNewContactCargo('')
    setSavingContact(false)
  }

  return (
    <div className="space-y-4">
      {/* RUT search */}
      <div className="space-y-1.5">
        <Label className="font-semibold">RUT empresa *</Label>
        <div className="relative">
          <Input
            value={rut}
            onChange={handleRutChange}
            placeholder="76.000.000-0"
            className="font-mono text-base"
          />
          {searching && (
            <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>
          )}
        </div>
      </div>

      {/* Cliente encontrado */}
      {client && (
        <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: '#1B8A4B', background: '#f0fdf4' }}>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: '#1B8A4B' }} />
            <span className="font-semibold text-gray-900">{client.name}</span>
            <span className="text-xs text-gray-400">{client.rut}</span>
          </div>

          {/* Contactos */}
          {client.contacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contactos</p>
              {client.contacts.map(c => (
                <button key={c.id} type="button"
                  onClick={() => selectContact(c)}
                  className="w-full text-left rounded-lg border p-3 transition-all"
                  style={selectedContactId === c.id
                    ? { borderColor: '#1B8A4B', background: 'white' }
                    : { borderColor: '#e5e7eb', background: 'white' }
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.cargo && <span className="text-xs text-gray-400">— {c.cargo}</span>}
                    </div>
                    {selectedContactId === c.id && <Check className="w-4 h-4" style={{ color: '#1B8A4B' }} />}
                  </div>
                  <div className="flex gap-4 mt-1 ml-5">
                    {c.phone_mobile && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone_mobile}
                      </span>
                    )}
                    {c.phone_landline && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone_landline}
                      </span>
                    )}
                    {c.email && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {c.email}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Agregar contacto */}
          {!showNewContact ? (
            <Button type="button" variant="outline" size="sm"
              onClick={() => setShowNewContact(true)}
              className="w-full border-dashed">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {client.contacts.length === 0 ? 'Agregar primer contacto' : 'Agregar otro contacto'}
            </Button>
          ) : (
            <div className="bg-white border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Nuevo contacto</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nombre *" value={newContactName} onChange={e => setNewContactName(e.target.value)} className="text-sm" />
                <Input placeholder="Cargo" value={newContactCargo} onChange={e => setNewContactCargo(e.target.value)} className="text-sm" />
                <Input placeholder="Celular" value={newContactMobile} onChange={e => setNewContactMobile(e.target.value)} className="text-sm" />
                <Input placeholder="Teléfono fijo" value={newContactLandline} onChange={e => setNewContactLandline(e.target.value)} className="text-sm" />
                <Input placeholder="Email" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} className="text-sm col-span-2" />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={savingContact}
                  style={{ background: '#1B8A4B' }} className="text-white"
                  onClick={saveNewContact}>
                  {savingContact ? 'Guardando...' : 'Guardar contacto'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewContact(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RUT no encontrado — crear empresa */}
      {notFound && showNewClient && (
        <div className="border border-dashed rounded-xl p-4 space-y-3 bg-amber-50 border-amber-200">
          <p className="text-sm font-semibold text-amber-800">RUT no registrado — completar datos de la empresa</p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Datos empresa</p>
            <Input placeholder="Nombre empresa *" value={newClientName}
              onChange={e => setNewClientName(e.target.value)} className="text-sm bg-white" />
            <Input placeholder="Dirección" value={newClientAddress}
              onChange={e => setNewClientAddress(e.target.value)} className="text-sm bg-white" />
            <Input placeholder="Email empresa *" type="email" value={newClientEmail}
              onChange={e => setNewClientEmail(e.target.value)} className="text-sm bg-white" />
            <Input placeholder="Teléfono fijo empresa" value={newClientLandline}
              onChange={e => setNewClientLandline(e.target.value)} className="text-sm bg-white" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Contacto principal *</p>
            <Input placeholder="Nombre contacto *" value={newClientContactName}
              onChange={e => setNewClientContactName(e.target.value)} className="text-sm bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Teléfono fijo" value={newClientLandline}
                onChange={e => setNewClientLandline(e.target.value)} className="text-sm bg-white" />
              <Input placeholder="Celular *" value={newClientMobile}
                onChange={e => setNewClientMobile(e.target.value)} className="text-sm bg-white" />
            </div>
            <Input placeholder="Email contacto" type="email" value={newClientEmail}
              onChange={e => setNewClientEmail(e.target.value)} className="text-sm bg-white" />
            <Input placeholder="Cargo" value={newClientContactCargo}
              onChange={e => setNewClientContactCargo(e.target.value)} className="text-sm bg-white" />
          </div>

          <Button type="button" size="sm" style={{ background: '#1B8A4B' }} className="text-white"
            onClick={saveNewClient}
            disabled={savingClient || !newClientName.trim()}>
            {savingClient ? 'Creando...' : 'Crear empresa y contacto'}
          </Button>
        </div>
      )}
    </div>
  )
}
