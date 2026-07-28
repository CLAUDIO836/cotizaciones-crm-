'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCLP } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import ClientRutSearch from '@/components/clients/ClientRutSearch'

// ── Google Places autocomplete (via server proxy) ────────────────────────────
interface PlacePrediction { description: string; place_id: string }

function AddressInput({ value, onChange, placeholder }: {
  value: string
  onChange: (address: string, lat?: number, lng?: number, placeId?: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { setQuery(value) }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    clearTimeout(timer.current)
    if (v.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(v)}`)
        const data = await res.json()
        if (data.predictions?.length > 0) {
          setSuggestions(data.predictions.map((p: { description: string; place_id: string }) => ({
            description: p.description,
            place_id: p.place_id,
          })))
          setOpen(true)
        } else {
          setSuggestions([]); setOpen(false)
        }
      } catch { setSuggestions([]); setOpen(false) }
    }, 350)
  }

  async function select(pred: PlacePrediction) {
    setQuery(pred.description)
    onChange(pred.description)
    setSuggestions([]); setOpen(false)
    try {
      const res = await fetch(`/api/places?place_id=${encodeURIComponent(pred.place_id)}`)
      const data = await res.json()
      const loc = data.result?.geometry?.location
      if (loc) onChange(pred.description, loc.lat, loc.lng, pred.place_id)
    } catch { /* lat/lng opcional */ }
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {suggestions.map(p => (
            <button key={p.place_id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
              onMouseDown={() => select(p)}>
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


// ────────────────────────────────────────────────────────────────────────────

interface Client {
  id: string; name: string; rut?: string
  contacto?: string; telefono_fijo?: string; telefono_celular?: string; email?: string
}
interface Pipeline { id: string; name: string; color: string }
interface Item {
  codigo: string
  description: string
  pasajeros: number
  quantity: number
  unit_price: number
  // campos extra para Traslado Diario (UI-only, se serializan en description)
  ruta_nombre?: string
  desde_item?: string
  hasta_item?: string
  hora_salida_item?: string
  hora_retorno_item?: string
}

// Parsear description si viene serializada como JSON para modo Diario
function parseItemDescription(item: Item): Item {
  try {
    const parsed = JSON.parse(item.description)
    if (parsed && typeof parsed === 'object' && parsed.__diario) {
      return {
        ...item,
        ruta_nombre: parsed.ruta ?? '',
        desde_item: parsed.desde ?? '',
        hasta_item: parsed.hasta ?? '',
        hora_salida_item: parsed.hora_salida ?? '',
        hora_retorno_item: parsed.hora_retorno ?? '',
        description: item.description, // mantener raw para el server
      }
    }
  } catch { /* description normal */ }
  return item
}

// Serializar campos diario a description JSON
function serializeItemDescription(item: Item): string {
  if (item.ruta_nombre !== undefined) {
    return JSON.stringify({
      __diario: true,
      ruta: item.ruta_nombre ?? '',
      desde: item.desde_item ?? '',
      hasta: item.hasta_item ?? '',
      hora_salida: item.hora_salida_item ?? '',
      hora_retorno: item.hora_retorno_item ?? '',
    })
  }
  return item.description
}

interface Seller { id: string; name: string; email?: string }
interface Company { id: string; name: string }

interface Props {
  clients: Client[]
  pipelines?: Pipeline[]
  sellers?: Seller[]
  companies?: Company[]
  userId: string
  quotation?: {
    id: string
    client_id: string
    client_name?: string
    client_rut?: string
    contact_id?: string | null
    vendedor_id?: string
    company_id?: string
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

const VEHICLES_CCL = [
  { key: 'bus',     label: 'Bus (40–45 pax)',     img: '/vehicles/bus-real.png',     desc: 'Servicio de transporte en Bus (40–45 pasajeros)' },
  { key: 'taxibus', label: 'Taxibús (25–33 pax)', img: '/vehicles/taxibus-real.png', desc: 'Servicio de transporte en Taxibús (25–33 pasajeros)' },
  { key: 'minibus', label: 'Minibús (14–19 pax)', img: '/vehicles/minibus-real.png', desc: 'Servicio de transporte en Minibús (14–19 pasajeros)' },
  { key: 'minivan', label: 'Minivan (7–11 pax)',  img: '/vehicles/minivan-real.png', desc: 'Servicio de transporte en Minivan (7–11 pasajeros)' },
]

const VEHICLES_TKS = [
  { key: 'bus',     label: 'Bus (40–60 pax)',     img: '/vehicles/tks-bus-grande.jpg', desc: 'Servicio de transporte en Bus (40–60 pasajeros) – Flota 2009 al 2016' },
  { key: 'taxibus', label: 'Taxibús (25–33 pax)', img: '/vehicles/tks-bus.jpg',        desc: 'Servicio de transporte en Taxibús (25–33 pasajeros) – Flota 2014 al 2018' },
  { key: 'minibus', label: 'Minibús (14–19 pax)', img: '/vehicles/tks-taxibus.jpg',    desc: 'Servicio de transporte en Minibús (14–19 pasajeros) – Flota 2014 al 2026' },
  { key: 'minivan', label: 'Minivan (7–10 pax)',  img: '/vehicles/tks-minivan.jpg',    desc: 'Servicio de transporte en Minivan (7–10 pasajeros) – Flota 2014 al 2026' },
]

// Códigos de vehículo para Traslado Diario (selector por ítem)
const VEHICLE_CODES = [
  { code: 'B45', label: 'Bus 45 pax' },
  { code: 'B40', label: 'Bus 40 pax' },
  { code: 'B33', label: 'Bus 33 pax' },
  { code: 'B25', label: 'Bus 25 pax' },
  { code: 'M19', label: 'Minibús 19 pax' },
  { code: 'M15', label: 'Minibús 15 pax' },
  { code: 'M10', label: 'Minibús 10 pax' },
  { code: 'V10', label: 'Van 10 pax' },
  { code: 'V9',  label: 'Van 9 pax' },
  { code: 'V7',  label: 'Van 7 pax' },
]

const ETAPAS = [
  { key: 'lead',        label: 'Lead' },
  { key: 'contactado',  label: 'Contactado' },
  { key: 'cotizacion',  label: 'Cotización' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'cierre',      label: 'Cierre' },
]

const DEFAULT_ITEM: Item = { codigo: '', description: '', pasajeros: 0, quantity: 1, unit_price: 0 }
const DEFAULT_DIARIO_ITEM: Item = {
  codigo: '', description: '', pasajeros: 0, quantity: 21, unit_price: 0,
  ruta_nombre: '', desde_item: '', hasta_item: '', hora_salida_item: '', hora_retorno_item: '',
}

export default function QuotationForm({ clients, pipelines = [], sellers = [], companies = [], userId, quotation }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Datos base
  const [clientId, setClientId] = useState(quotation?.client_id ?? '')
  const [pipelineId, setPipelineId] = useState(quotation?.pipeline_id ?? '')
  const [etapa, setEtapa] = useState(quotation?.etapa ?? 'lead')
  const [vehicleType, setVehicleType] = useState(quotation?.vehicle_type ?? '')
  const [issueDate, setIssueDate] = useState(quotation?.issue_date ?? new Date().toISOString().split('T')[0])
  const [expiryDate, setExpiryDate] = useState(quotation?.expiry_date ?? '')
  const [taxPct, setTaxPct] = useState(quotation?.tax_pct ?? 0)
  const [descuentoPct, setDescuentoPct] = useState(quotation?.descuento_pct ?? 0)

  // Ruta / servicio
  const [desde, setDesde] = useState(quotation?.desde ?? '')
  const [hasta, setHasta] = useState(quotation?.hasta ?? '')
  const [desdePlaceId, setDesdePlaceId] = useState<string>()
  const [hastaPlaceId, setHastaPlaceId] = useState<string>()
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null)
  const [duracionText, setDuracionText] = useState<string | null>(null)

  useEffect(() => {
    if (!desdePlaceId || !hastaPlaceId) { setDistanciaKm(null); setDuracionText(null); return }
    fetch(`/api/places?origin=${encodeURIComponent(desdePlaceId)}&destination=${encodeURIComponent(hastaPlaceId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.distance_m) {
          setDistanciaKm(Math.round(d.distance_m / 1000))
          setDuracionText(d.duration_text ?? null)
        }
      })
      .catch(() => { setDistanciaKm(null); setDuracionText(null) })
  }, [desdePlaceId, hastaPlaceId])
  const [fechaSalida, setFechaSalida] = useState(quotation?.fecha_salida?.slice(0, 16) ?? '')
  const [fechaDestino, setFechaDestino] = useState(quotation?.fecha_destino?.slice(0, 16) ?? '')

  // Textos
  const [observaciones, setObservaciones] = useState(quotation?.observaciones ?? '')
  const [notes, setNotes] = useState(quotation?.notes ?? '')
  const [terms, setTerms] = useState(quotation?.terms ?? '')

  // Detectar si el pipeline inicial ya es Diario (para el item por defecto)
  const initialIsDiario = pipelines.find(p => p.id === (quotation?.pipeline_id ?? ''))?.name?.toLowerCase().includes('diario') ?? false

  // Ítems (parsear description JSON si viene de modo Diario)
  const [items, setItems] = useState<Item[]>(
    quotation?.items?.length
      ? quotation.items.map(parseItemDescription)
      : [initialIsDiario ? { ...DEFAULT_DIARIO_ITEM } : { ...DEFAULT_ITEM }]
  )

  const [companyId, setCompanyId] = useState(() => quotation?.company_id ?? (companies.length === 1 ? companies[0].id : ''))
  const [contactId, setContactId] = useState<string | null>(quotation?.contact_id ?? null)

  // Auto-calcular fecha de vencimiento según embudo
  useEffect(() => {
    if (!issueDate) return
    const pipeline = pipelines.find(p => p.id === pipelineId)
    const days = pipeline?.name?.toLowerCase().includes('traslado diario') ? 15 : 5
    const d = new Date(issueDate)
    d.setDate(d.getDate() + days)
    setExpiryDate(d.toISOString().split('T')[0])
  }, [pipelineId, issueDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedUserId, setSelectedUserId] = useState(quotation?.vendedor_id ?? '')

  // Nuevo cliente inline
  const [newClientName, setNewClientName] = useState('')
  const [newClientRut, setNewClientRut] = useState('')
  const [newClientContacto, setNewClientContacto] = useState('')
  const [newClientTelFijo, setNewClientTelFijo] = useState('')
  const [newClientCelular, setNewClientCelular] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)

  // ¿Es embudo Traslado Diario?
  const isDiario = pipelines.find(p => p.id === pipelineId)?.name?.toLowerCase().includes('diario') ?? false

  const subtotalNeto = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const descuentoAmt = subtotalNeto * (descuentoPct / 100)
  const baseConDescuento = subtotalNeto - descuentoAmt
  const taxAmount = baseConDescuento * (taxPct / 100)
  const total = baseConDescuento + taxAmount
  const totalAnual = baseConDescuento * 12

  function updateItem(idx: number, field: keyof Item, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  function updateItemStr(idx: number, field: keyof Item, value: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function createNewClient(): Promise<string | null> {
    if (!newClientName.trim()) return null
    if (!newClientCelular.trim() && !newClientTelFijo.trim()) { toast.error('El cliente debe tener al menos un teléfono'); return null }
    if (!newClientEmail.trim()) { toast.error('El email del cliente es obligatorio'); return null }
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newClientName.trim(),
        rut: newClientRut.trim() || null,
        contacto: newClientContacto.trim() || null,
        telefono_fijo: newClientTelFijo.trim() || null,
        telefono_celular: newClientCelular.trim() || null,
        email: newClientEmail.trim() || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error('Error al crear cliente'); return null }
    return json.data?.id ?? null
  }

  const isEditing = !!quotation?.id
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [motivo, setMotivo] = useState('')

  async function saveQuotation(withPdf: boolean) {
    if (!clientId) { toast.error('Busca y selecciona un cliente por RUT'); return }
    if (!selectedUserId) { toast.error('Selecciona un vendedor'); return }
    if (items.some(i => !i.description.trim())) { toast.error('Completa la descripción de todos los ítems'); return }
    if (!isDiario && items.some(i => !i.pasajeros || i.pasajeros <= 0)) { toast.error('Indica la cantidad de pasajeros en cada ítem'); return }

    withPdf ? setLoadingPdf(true) : setLoading(true)
    try {
      const finalClientId = clientId

      const qRes = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEditing ? { id: quotation.id } : {}),
          client_id: finalClientId,
          user_id: selectedUserId,
          pipeline_id: pipelineId || null,
          etapa,
          vehicle_type: vehicleType || null,
          issue_date: issueDate,
          expiry_date: expiryDate || null,
          company_id: companyId || null,
          company: companies.find(c => c.id === companyId)?.name ?? null,
          contact_id: contactId || null,
          desde: desde || null,
          hasta: hasta || null,
          ...(distanciaKm !== null ? { distancia_km: distanciaKm } : {}),
          fecha_salida: fechaSalida || null,
          fecha_destino: fechaDestino || null,
          descuento_pct: descuentoPct,
          observaciones: observaciones || null,
          subtotal: baseConDescuento,
          tax_pct: taxPct,
          total,
          notes: notes || null,
          terms: terms || null,
          items: items.map((item, idx) => ({
            codigo: item.codigo || null,
            description: serializeItemDescription(item),
            pasajeros: item.pasajeros || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            sort_order: idx,
          })),
        }),
      })
      if (!qRes.ok) {
        const errJson = await qRes.json().catch(() => ({}))
        throw new Error(errJson.error ?? `HTTP ${qRes.status}`)
      }
      const qData = await qRes.json()

      if (isEditing) {
        if (withPdf) {
          try {
            await fetch('/api/pipedrive/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quotationId: quotation.id, resync: true, motivo: motivo || null }),
            })
            toast.success('Cotización actualizada — nuevo PDF subido a Pipedrive')
          } catch {
            toast.success('Cotización actualizada (PDF pendiente)')
          }
        } else {
          toast.success('Cotización actualizada')
        }
        router.push(`/cotizaciones/${quotation.id}`)
      } else {
        // Al crear: crear deal en Pipedrive y subir PDF
        try {
          const uploadRes = await fetch('/api/pipedrive/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quotationId: qData.id,
              pipelineId: pipelineId || null,
              fechaSalida: fechaSalida || null,
              companyName: companies.find(c => c.id === companyId)?.name ?? null,
              desde: desde || null,
              hasta: hasta || null,
            }),
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
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la cotización')
    } finally {
      setLoading(false)
      setLoadingPdf(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveQuotation(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── EMPRESA + VENDEDOR ── */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
        <div className="grid grid-cols-2 gap-4">
          {companies.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-blue-700 font-semibold">Empresa *</Label>
              <Select value={companyId || null} onValueChange={v => setCompanyId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa...">
                    {companies.find(c => c.id === companyId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {sellers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-blue-700 font-semibold">Vendedor *</Label>
              <Select value={selectedUserId || null} onValueChange={v => setSelectedUserId(v ?? userId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor...">
                    {sellers.find(s => s.id === selectedUserId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-xs text-blue-500 mt-2">Al crear la cotización se generará automáticamente un negocio en Pipedrive.</p>
      </div>

      {/* ── CLIENTE ── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Cliente</h2>
        <ClientRutSearch
          onSelect={(cId, ctId) => { setClientId(cId); setContactId(ctId) }}
          defaultClientId={quotation?.client_id}
          defaultClientName={quotation?.client_name}
          defaultClientRut={quotation?.client_rut}
          defaultContactId={quotation?.contact_id}
        />

        {/* Pipeline + Etapa */}
        <div className="grid grid-cols-2 gap-4">
          {pipelines.length > 0 && (
            <div className="space-y-1.5">
              <Label>Embudo</Label>
              <Select value={pipelineId || null} onValueChange={v => setPipelineId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar embudo...">
                    {pipelines.find(p => p.id === pipelineId)?.name}
                  </SelectValue>
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

        {/* Vehículo — solo para servicios especiales (en diario va por ítem) */}
        <div className="space-y-1.5" style={isDiario ? { display: 'none' } : {}}>
          <Label>Tipo de vehículo</Label>
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const isTKS = companies?.find(c => c.id === companyId)?.name === 'Transportes TKS'
              const vehicles = isTKS ? VEHICLES_TKS : VEHICLES_CCL
              const selectedColor = isTKS ? '#C8102E' : '#1B8A4B'
              return vehicles.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    setVehicleType(vehicleType === v.key ? '' : v.key)
                    if (vehicleType !== v.key) {
                      setItems(prev => {
                        const next = [...prev]
                        const last = next.length - 1
                        next[last] = { ...next[last], codigo: v.key.toUpperCase(), description: v.desc }
                        return next
                      })
                    }
                  }}
                  className="relative rounded-xl border-2 overflow-hidden transition-all text-left"
                  style={vehicleType === v.key ? { borderColor: selectedColor } : { borderColor: '#e5e7eb' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.img} alt={v.label} className="w-full h-16 object-cover" />
                  <div className="px-2 py-1.5"
                    style={vehicleType === v.key ? { background: selectedColor } : { background: '#f9fafb' }}>
                    <p className="text-xs font-semibold truncate"
                      style={{ color: vehicleType === v.key ? 'white' : '#374151' }}>
                      {v.label}
                    </p>
                  </div>
                </button>
              ))
            })()}
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

      {/* ── RUTA / SERVICIO — solo para servicios especiales ── */}
      {!isDiario && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Ruta / Servicio</h2>
            {distanciaKm !== null && (
              <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: '#e8f5e9', color: '#1B8A4B' }}>
                {distanciaKm} km en ruta{duracionText ? ` · ${duracionText}` : ''}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <AddressInput
                value={desde}
                onChange={(addr, _lat, _lng, pid) => { setDesde(addr); if (pid) setDesdePlaceId(pid) }}
                placeholder="Dirección de origen"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <AddressInput
                value={hasta}
                onChange={(addr, _lat, _lng, pid) => { setHasta(addr); if (pid) setHastaPlaceId(pid) }}
                placeholder="Dirección de destino"
              />
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
      )}

      {/* ── ÍTEMS: modo Traslado Diario ── */}
      {isDiario ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between border-b"
            style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div>
              <h2 className="font-bold text-sm" style={{ color: '#1B8A4B' }}>
                Rutas del Servicio Diario
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Cada fila es una ruta. El descuento se aplica globalmente a todas.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {descuentoPct > 0 && (
                <span className="px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                  {descuentoPct}% dto. aplicado
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-3">
            {/* Columnas header */}
            <div className="grid gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1"
              style={{ gridTemplateColumns: '2fr 130px 60px 70px 130px 130px 110px 32px' }}>
              <span>Ruta / Descripción</span>
              <span>Vehículo</span>
              <span className="text-center">Pax</span>
              <span className="text-center">Días/mes</span>
              <span className="text-right">Precio lista</span>
              <span className="text-right">Precio neto</span>
              <span className="text-right">Total mensual</span>
              <span />
            </div>

            {/* Filas de rutas */}
            {items.map((item, idx) => {
              const precioLista = descuentoPct > 0
                ? Math.round(item.unit_price / (1 - descuentoPct / 100))
                : item.unit_price
              const totalMensual = item.quantity * item.unit_price
              const totalMensualLista = item.quantity * precioLista

              return (
                <div key={idx}
                  className="rounded-xl border"
                  style={{ borderColor: '#e5e7eb' }}>

                  {/* Cabecera de fila: nombre ruta + vehículo + números + eliminar */}
                  <div className="grid gap-2 items-center px-3 py-2.5 bg-gray-50"
                    style={{ gridTemplateColumns: '1fr 130px 60px 70px 110px 120px 110px 32px' }}>

                    {/* Nombre de la ruta */}
                    <Input
                      placeholder="Ej: Ruta Santiago → Vespucio"
                      value={item.ruta_nombre ?? ''}
                      onChange={e => updateItemStr(idx, 'ruta_nombre', e.target.value)}
                      required
                      className="text-sm font-semibold"
                    />

                    {/* Vehículo */}
                    <select
                      value={item.codigo}
                      onChange={e => updateItem(idx, 'codigo', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ color: item.codigo ? '#1B8A4B' : '#9ca3af' }}
                    >
                      <option value="">Vehículo...</option>
                      {VEHICLE_CODES.map(v => (
                        <option key={v.code} value={v.code}>{v.label}</option>
                      ))}
                    </select>

                    {/* Pasajeros */}
                    <Input
                      type="number" min={1} step={1}
                      placeholder="Pax"
                      value={item.pasajeros || ''}
                      onChange={e => updateItem(idx, 'pasajeros', parseInt(e.target.value) || 0)}
                      className="text-center text-sm"
                    />

                    {/* Días/mes */}
                    <Input
                      type="number" min={1} step={1} max={31}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="text-center text-sm"
                      title="Días o servicios por mes"
                    />

                    {/* Precio lista — computed */}
                    <div className="text-right pr-1">
                      <div className="text-xs text-gray-400 line-through leading-tight">
                        {descuentoPct > 0 ? formatCLP(precioLista) : '—'}
                      </div>
                    </div>

                    {/* Precio neto — editable */}
                    <Input
                      type="number" min={0} step={1000}
                      value={item.unit_price || ''}
                      onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="text-right text-sm font-semibold"
                      placeholder="0"
                    />

                    {/* Total mensual */}
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: '#1B8A4B' }}>
                        {formatCLP(totalMensual)}
                      </div>
                      {descuentoPct > 0 && (
                        <div className="text-xs text-gray-400 line-through leading-tight">
                          {formatCLP(totalMensualLista)}
                        </div>
                      )}
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-500 flex justify-center"
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Detalle de ruta: Desde / Hasta + Horarios */}
                  <div className="px-3 py-2.5 border-t grid grid-cols-2 gap-3"
                    style={{ borderColor: '#f3f4f6', background: '#fff' }}>
                    {/* Columna izquierda: Desde → Hasta */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Desde</label>
                          <AddressInput
                            value={item.desde_item ?? ''}
                            onChange={addr => updateItemStr(idx, 'desde_item', addr)}
                            placeholder="Origen de la ruta"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hasta</label>
                          <AddressInput
                            value={item.hasta_item ?? ''}
                            onChange={addr => updateItemStr(idx, 'hasta_item', addr)}
                            placeholder="Destino de la ruta"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Columna derecha: Horarios */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Horarios</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">Salida</span>
                          <Input
                            type="time"
                            value={item.hora_salida_item ?? ''}
                            onChange={e => updateItemStr(idx, 'hora_salida_item', e.target.value)}
                            className="pl-14 text-sm"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">Retorno</span>
                          <Input
                            type="time"
                            value={item.hora_retorno_item ?? ''}
                            onChange={e => updateItemStr(idx, 'hora_retorno_item', e.target.value)}
                            className="pl-16 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Agregar ruta */}
            <Button type="button" variant="outline" size="sm"
              onClick={() => setItems(prev => [...prev, { ...DEFAULT_DIARIO_ITEM }])}
              style={{ borderColor: '#1B8A4B', color: '#1B8A4B' }}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar ruta
            </Button>

            {/* Descuento global */}
            <div className="border-t pt-4 flex items-start justify-between gap-4">
              {/* Descuento */}
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap text-gray-600 font-semibold">Descuento global (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={100} step={0.5}
                    value={descuentoPct}
                    onChange={e => setDescuentoPct(parseFloat(e.target.value) || 0)}
                    className="w-20 text-center font-bold"
                    style={descuentoPct > 0 ? { borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb' } : {}}
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
                {descuentoPct > 0 && (
                  <span className="text-sm text-amber-600 font-medium">
                    Ahorro: {formatCLP(Math.round(subtotalNeto / (1 - descuentoPct / 100)) - subtotalNeto)}
                  </span>
                )}
              </div>

              {/* Resumen totales */}
              <div className="space-y-1 min-w-[260px]">
                {descuentoPct > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Precio lista (sin dto.)</span>
                      <span className="line-through">{formatCLP(Math.round(subtotalNeto / (1 - descuentoPct / 100)))}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600 font-medium">
                      <span>Descuento ({descuentoPct}%)</span>
                      <span>−{formatCLP(Math.round(subtotalNeto / (1 - descuentoPct / 100)) - subtotalNeto)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal neto mensual</span>
                  <span className="font-semibold">{formatCLP(subtotalNeto)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>IVA (Decreto 80 — Exento)</span>
                  <span>$0</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2"
                  style={{ color: '#1B8A4B', borderColor: '#bbf7d0' }}>
                  <span>Total mensual</span>
                  <span>{formatCLP(subtotalNeto)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border">
                  <span>Proyección anual (×12)</span>
                  <span>{formatCLP(totalAnual)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── ÍTEMS modo estándar ── */
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Ítems / Servicios</h2>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
              <span className="col-span-2">Código</span>
              <span className="col-span-4">Descripción</span>
              <span className="col-span-1 text-center">Pax *</span>
              <span className="col-span-1 text-center">Cant.</span>
              <span className="col-span-2 text-right">Precio unit.</span>
              <span className="col-span-1 text-right">Total</span>
              <span className="col-span-1" />
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-2"
                  placeholder="BUS"
                  value={item.codigo}
                  onChange={e => updateItem(idx, 'codigo', e.target.value)}
                />
                <Input
                  className="col-span-4"
                  placeholder="Descripción del servicio"
                  value={item.description}
                  onChange={e => updateItem(idx, 'description', e.target.value)}
                  required
                />
                <Input
                  className="col-span-1 text-center"
                  type="number" min={1} step={1}
                  placeholder="0"
                  value={item.pasajeros || ''}
                  onChange={e => updateItem(idx, 'pasajeros', parseInt(e.target.value) || 0)}
                  title="Cantidad de pasajeros a trasladar"
                  style={(!item.pasajeros || item.pasajeros <= 0) ? { borderColor: '#f97316' } : {}}
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
      )}

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

      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide block mb-1.5">
            Motivo del cambio (opcional, aparece en historial de documentos)
          </label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Ajuste de precio por solicitud del cliente"
            className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {isEditing ? (
          <>
            <Button type="submit" disabled={loading || loadingPdf} style={{ background: '#1B8A4B' }} className="text-white">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button type="button" disabled={loading || loadingPdf}
              onClick={() => saveQuotation(true)}
              style={{ background: '#1d4ed8' }} className="text-white">
              {loadingPdf ? 'Generando PDF...' : 'Guardar y generar PDF'}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={loading} style={{ background: '#1B8A4B' }} className="text-white">
            {loading ? 'Guardando...' : 'Crear cotización'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading || loadingPdf}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
