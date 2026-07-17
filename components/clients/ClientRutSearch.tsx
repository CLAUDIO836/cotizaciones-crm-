'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
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
    const { data } = await supabase
      .from('clients')
      .select('id, name, rut, address')
      .ilike('rut', `%${rawRut.replace(/\./g, '')}%`)
      .limit(1)
      .single()

    if (data) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, phone_mobile, phone_landline, cargo')
        .eq('client_id', data.id)
        .order('created_at')
      setClient({ ...data, contacts: contacts ?? [] })
      setNotFound(false)
      setShowNewClient(false)
      if (contacts && contacts.length === 1) {
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
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), rut: rut || null, address: newClientAddress || null })
      .select('id, name, rut, address')
      .single()
    if (error || !data) return
    setClient({ ...data, contacts: [] })
    setNotFound(false)
    setShowNewClient(false)
    setShowNewContact(true)
    onSelect(data.id, null)
  }

  async function saveNewContact() {
    if (!newContactName.trim() || !client) return
    setSavingContact(true)
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        client_id: client.id,
        name: newContactName.trim(),
        email: newContactEmail || null,
        phone_mobile: newContactMobile || null,
        phone_landline: newContactLandline || null,
        cargo: newContactCargo || null,
      })
      .select()
      .single()
    if (error || !data) { setSavingContact(false); return }
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
          <p className="text-sm font-medium text-amber-700">RUT no registrado — crear empresa nueva</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nombre empresa *" value={newClientName}
              onChange={e => setNewClientName(e.target.value)} className="text-sm" />
            <Input placeholder="Dirección" value={newClientAddress}
              onChange={e => setNewClientAddress(e.target.value)} className="text-sm" />
          </div>
          <Button type="button" size="sm" style={{ background: '#1B8A4B' }} className="text-white"
            onClick={saveNewClient} disabled={!newClientName.trim()}>
            Crear empresa
          </Button>
        </div>
      )}
    </div>
  )
}
