'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCLP } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

interface Client {
  id: string; name: string; rut?: string
  contacto?: string; telefono_fijo?: string; telefono_celular?: string; email?: string
}
interface Pipeline { id: string; name: string; color: string }
interface Item { codigo: string; description: string; quantity: number; unit_price: number }

interface Seller { id: string; name: string; email?: string }

interface Props {
  clients: Client[]
  pipelines?: Pipeline[]
  sellers?: Seller[]
  userId: string
  quotation?: {
    id: string
    client_id: string
    pipeline_id?: string
    etapa?: string
    vehicle_type?: string
    issue_date: string
    expiry_date?: string
    desde?: string
    hasta?: string
    fecha_salida?: string
    fecha_destino?: string
    descuento_pct?: number
    observaciones?: string
    notes?: string
    terms?: string
    tax_pct: number
    items: Item[]
  }
}

const VEHICLES = [
  { key: 'bus',     label: 'Bus (40–45 pax)',     img: '/vehicles/bus-real.png' },
  { key: 'taxibus', label: 'Taxibús (25–33 pax)', img: '/vehicles/taxibus-real.png' },
  { key: 'minibus', label: 'Minibús (14–19 pax)', img: '/vehicles/minibus-real.png' },
  { key: 'minivan', label: 'Minivan (7–11 pax)',  img: '/vehicles/minivan-real.png' },
]

const ETAPAS = [
  { key: 'lead',        label: 'Lead' },
  { key: 'contactado',  label: 'Contactado' },
  { key: 'cotizacion',  label: 'Cotización' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'cierre',      label: 'Cierre' },
]

const DEFAULT_ITEM: Item = { codigo: '', description: '', quantity: 1, unit_price: 0 }

export default function QuotationForm({ clients, pipelines = [], sellers = [], userId, quotation }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // Datos base
  const [clientId, setClientId] = useState(quotation?.client_id ?? '')
  const [pipelineId, setPipelineId] = useState(quotation?.pipeline_id ?? '')
  const [etapa, setEtapa] = useState(quotation?.etapa ?? 'lead')
  const [vehicleType, setVehicleType] = useState(quotation?.vehicle_type ?? '')
  const [issueDate, setIssueDate] = useState(quotation?.issue_date ?? new Date().toISOString().split('T')[0])
  const [expiryDate, setExpiryDate] = useState(quotation?.expiry_date ?? '')
  const [taxPct, setTaxPct] = useState(quotation?.tax_pct ?? 19)
  const [descuentoPct, setDescuentoPct] = useState(quotation?.descuento_pct ?? 0)

  // Ruta / servicio
  const [desde, setDesde] = useState(quotation?.desde ?? '')
  const [hasta, setHasta] = useState(quotation?.hasta ?? '')
  const [fechaSalida, setFechaSalida] = useState(quotation?.fecha_salida?.slice(0, 16) ?? '')
  const [fechaDestino, setFechaDestino] = useState(quotation?.fecha_destino?.slice(0, 16) ?? '')

  // Textos
  const [observaciones, setObservaciones] = useState(quotation?.observaciones ?? '')
  const [notes, setNotes] = useState(quotation?.notes ?? '')
  const [terms, setTerms] = useState(quotation?.terms ?? '')

  // Ítems
  const [items, setItems] = useState<Item[]>(
    quotation?.items?.length ? quotation.items : [{ ...DEFAULT_ITEM }]
  )

  // Vendedor — vacío para mostrar placeholder y forzar selección
  const [selectedUserId, setSelectedUserId] = useState('')

  // Nuevo cliente inline
  const [newClientName, setNewClientName] = useState('')
  const [newClientRut, setNewClientRut] = useState('')
  const [newClientContacto, setNewClientContacto] = useState('')
  const [newClientTelFijo, setNewClientTelFijo] = useState('')
  const [newClientCelular, setNewClientCelular] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)

  const subtotalNeto = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const descuentoAmt = subtotalNeto * (descuentoPct / 100)
  const baseConDescuento = subtotalNeto - descuentoAmt
  const taxAmount = baseConDescuento * (taxPct / 100)
  const total = baseConDescuento + taxAmount

  function updateItem(idx: number, field: keyof Item, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function createNewClient(): Promise<string | null> {
    if (!newClientName.trim()) return null
    const { data, error } = await supabase
      .from('clients')
      .insert({
          name: newClientName.trim(),
          rut: newClientRut.trim() || null,
          contacto: newClientContacto.trim() || null,
          telefono_fijo: newClientTelFijo.trim() || null,
          telefono_celular: newClientCelular.trim() || null,
          email: newClientEmail.trim() || null,
        })
      .select('id')
      .single()
    if (error) { toast.error('Error al crear cliente'); return null }
    return data.id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId && !newClientName) { toast.error('Selecciona o crea un cliente'); return }
    if (!selectedUserId) { toast.error('Selecciona un vendedor'); return }
    if (items.some(i => !i.description.trim())) { toast.error('Completa la descripción de todos los ítems'); return }

    setLoading(true)
    try {
      let finalClientId = clientId
      if (showNewClient) {
        const newId = await createNewClient()
        if (!newId) { setLoading(false); return }
        finalClientId = newId
      }

      const number = `TEMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

      const { data: qData, error: qErr } = await supabase
        .from('quotations')
        .insert({
          number,
          client_id: finalClientId,
          user_id: selectedUserId,
          pipeline_id: pipelineId || null,
          etapa,
          vehicle_type: vehicleType || null,
          issue_date: issueDate,
          expiry_date: expiryDate || null,
          desde: desde || null,
          hasta: hasta || null,
          fecha_salida: fechaSalida || null,
          fecha_destino: fechaDestino || null,
          descuento_pct: descuentoPct,
          observaciones: observaciones || null,
          subtotal: baseConDescuento,
          tax_pct: taxPct,
          total,
          notes: notes || null,
          terms: terms || null,
        })
        .select('id')
        .single()

      if (qErr) throw qErr

      const itemsToInsert = items.map((item, idx) => ({
        quotation_id: qData.id,
        codigo: item.codigo || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: idx,
      }))

      const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsToInsert)
      if (itemsErr) throw itemsErr

      // Crear negocio en Pipedrive y subir PDF
      try {
        const uploadRes = await fetch('/api/pipedrive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quotationId: qData.id, pipelineId: pipelineId || null, fechaSalida: fechaSalida || null }),
        })
        const uploadJson = await uploadRes.json()
        if (uploadJson.dealId) {
          toast.success(`Cotización creada — Negocio #${uploadJson.dealId} creado en Pipedrive`)
        } else {
          toast.success('Cotización creada')
        }
      } catch {
        toast.success('Cotización creada (sin conexión a Pipedrive)')
      }
      router.push(`/cotizaciones/${qData.id}`)
    } catch {
      toast.error('Error al guardar la cotización')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── VENDEDOR ── */}
      {sellers.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <div className="space-y-1.5">
            <Label className="text-blue-700 font-semibold">Vendedor *</Label>
            <Select value={selectedUserId} onValueChange={v => setSelectedUserId(v ?? userId)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {sellers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-500">Al crear la cotización se generará automáticamente un negocio en Pipedrive.</p>
          </div>
        </div>
      )}

      {/* ── CLIENTE ── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Cliente</h2>

        {!showNewClient ? (
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <div className="flex gap-2">
              <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.rut ? ` — ${c.rut}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => { setShowNewClient(true); setClientId('') }}>
                + Nuevo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre empresa *</Label>
              <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Empresa S.A." />
            </div>
            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input value={newClientRut} onChange={e => setNewClientRut(e.target.value)} placeholder="76.000.000-0" />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre contacto</Label>
              <Input value={newClientContacto} onChange={e => setNewClientContacto(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="juan@empresa.cl" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono fijo</Label>
              <Input value={newClientTelFijo} onChange={e => setNewClientTelFijo(e.target.value)} placeholder="222 345 678" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono celular</Label>
              <Input value={newClientCelular} onChange={e => setNewClientCelular(e.target.value)} placeholder="9 1234 5678" />
            </div>
            <div className="col-span-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewClient(false)}>
                ← Cliente existente
              </Button>
            </div>
          </div>
        )}

        {/* Pipeline + Etapa */}
        <div className="grid grid-cols-2 gap-4">
          {pipelines.length > 0 && (
            <div className="space-y-1.5">
              <Label>Embudo</Label>
              <Select value={pipelineId} onValueChange={v => setPipelineId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar embudo..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 col-span-2">
            <Label>Etapa</Label>
            <div className="flex gap-2 flex-wrap">
              {ETAPAS.map(e => (
                <button key={e.key} type="button" onClick={() => setEtapa(e.key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                  style={etapa === e.key
                    ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' }
                    : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >{e.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Vehículo */}
        <div className="space-y-1.5">
          <Label>Tipo de vehículo</Label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVehicleType(vehicleType === v.key ? '' : v.key)}
                className="relative rounded-xl border-2 overflow-hidden transition-all text-left"
                style={vehicleType === v.key
                  ? { borderColor: '#1B8A4B' }
                  : { borderColor: '#e5e7eb' }
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.img} alt={v.label} className="w-full h-16 object-cover" />
                <div className="px-2 py-1.5"
                  style={vehicleType === v.key ? { background: '#1B8A4B' } : { background: '#f9fafb' }}>
                  <p className="text-xs font-semibold truncate"
                    style={{ color: vehicleType === v.key ? 'white' : '#374151' }}>
                    {v.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Fecha emisión *</Label>
            <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Válida hasta</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>IVA (%)</Label>
            <Input type="number" value={taxPct} onChange={e => setTaxPct(parseFloat(e.target.value) || 0)} min={0} max={100} />
          </div>
        </div>
      </div>

      {/* ── RUTA / SERVICIO ── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Ruta / Servicio</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input value={desde} onChange={e => setDesde(e.target.value)} placeholder="Dirección de origen" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input value={hasta} onChange={e => setHasta(e.target.value)} placeholder="Dirección de destino" />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha salida</Label>
            <Input type="datetime-local" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha destino / retorno</Label>
            <Input type="datetime-local" value={fechaDestino} onChange={e => setFechaDestino(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── ÍTEMS ── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Ítems / Servicios</h2>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
            <span className="col-span-2">Código</span>
            <span className="col-span-5">Descripción</span>
            <span className="col-span-1 text-center">Cant.</span>
            <span className="col-span-2 text-right">Precio unit.</span>
            <span className="col-span-1 text-right">Total</span>
            <span className="col-span-1" />
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-2"
                placeholder="A30"
                value={item.codigo}
                onChange={e => updateItem(idx, 'codigo', e.target.value)}
              />
              <Input
                className="col-span-5"
                placeholder="Descripción del servicio"
                value={item.description}
                onChange={e => updateItem(idx, 'description', e.target.value)}
                required
              />
              <Input
                className="col-span-1 text-center"
                type="number" min={0.01} step={0.01}
                value={item.quantity}
                onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
              />
              <Input
                className="col-span-2 text-right"
                type="number" min={0} step={1}
                value={item.unit_price}
                onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
              />
              <div className="col-span-1 text-right text-sm font-semibold text-gray-700">
                {formatCLP(item.quantity * item.unit_price)}
              </div>
              <button
                type="button"
                onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                className="col-span-1 text-gray-300 hover:text-red-500 flex justify-center"
                disabled={items.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm"
          onClick={() => setItems(prev => [...prev, { ...DEFAULT_ITEM }])}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar ítem
        </Button>

        {/* Totales */}
        <div className="border-t pt-4 ml-auto max-w-xs space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal neto</span>
            <span>{formatCLP(subtotalNeto)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500 gap-4">
            <span className="whitespace-nowrap">Descuento (%)</span>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} max={100} step={0.5}
                value={descuentoPct}
                onChange={e => setDescuentoPct(parseFloat(e.target.value) || 0)}
                className="w-16 text-right text-sm"
              />
              <span className="text-sm text-gray-500 w-20 text-right">{formatCLP(descuentoAmt)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>IVA ({taxPct}%)</span>
            <span>{formatCLP(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t pt-2">
            <span>TOTAL</span>
            <span style={{ color: '#1B8A4B' }}>{formatCLP(total)}</span>
          </div>
        </div>
      </div>

      {/* ── OBSERVACIONES ── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Observaciones</h2>
        <Textarea
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          placeholder="Observaciones para el cliente (aparecen en la cotización)..."
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Notas internas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas internas (no aparecen en PDF)..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Términos y condiciones</Label>
            <Textarea value={terms} onChange={e => setTerms(e.target.value)}
              placeholder="Condiciones de pago, entrega, etc..." rows={2} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} style={{ background: '#1B8A4B' }} className="text-white">
          {loading ? 'Guardando...' : (quotation ? 'Guardar cambios' : 'Crear cotización')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
