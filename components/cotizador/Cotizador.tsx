'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AddressInput, { type PlaceSelection } from '@/components/maps/AddressInput'
import ClientRutSearch from '@/components/clients/ClientRutSearch'
import { CODIGO_FORMATO, guardarHandoff } from '@/lib/cotizador-handoff'
import { formatCLP } from '@/lib/utils'
import type { FormatoId, Modalidad, ResultadoTarifa, Servicio } from '@/lib/tarifario'
import { Plus, Trash2, MapPin, AlertTriangle, CheckCircle2, XCircle, Copy, FilePlus2 } from 'lucide-react'

// Tipos de cliente = embudos de Pipedrive que ya usa el CRM
const TIPOS_CLIENTE = [
  { pipeline: '12', label: 'Colegio / establecimiento educacional' },
  { pipeline: '14', label: 'Empresa' },
  { pipeline: '13', label: 'Persona natural' },
]
const PIPELINE_CONTRATO = '15' // TRASLADO DIARIO

const FORMATOS: { id: FormatoId; label: string }[] = [
  { id: 'bus45', label: 'Bus 45 pasajeros' },
  { id: 'taxibus30', label: 'Taxibús 30 pasajeros' },
  { id: 'taxibus25', label: 'Taxibús 25 pasajeros' },
  { id: 'minibus19', label: 'Minibús 19 pasajeros' },
  { id: 'minibus17', label: 'Minibús 17 pasajeros' },
  { id: 'minibus15', label: 'Minibús 15 pasajeros' },
  { id: 'van11', label: 'Van 11 pasajeros' },
]
const CAPACIDAD: Record<FormatoId, number> = { bus45: 45, taxibus30: 30, taxibus25: 25, minibus19: 19, minibus17: 17, minibus15: 15, van11: 11 }

const MODALIDADES: { id: Modalidad; label: string; ayuda: string }[] = [
  { id: 'mismo_dia', label: 'Mismo día', ayuda: 'Ida en la mañana y regreso el mismo día, deja y retira' },
  { id: 'otro_dia', label: 'Regreso otro día', ayuda: 'Ida un día y regreso otro (día completo + medio servicio)' },
  { id: 'solo_ida', label: 'Solo ida', ayuda: 'Un traslado sin regreso' },
  { id: 'a_disposicion', label: 'A disposición', ayuda: 'El vehículo queda con el grupo' },
]

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30'
const vacio: PlaceSelection = { address: '' }

function formatoSugerido(pasajeros: number): FormatoId {
  const orden = (Object.keys(CAPACIDAD) as FormatoId[]).sort((a, b) => CAPACIDAD[a] - CAPACIDAD[b])
  return orden.find(f => CAPACIDAD[f] >= pasajeros) ?? 'bus45'
}

interface Seller { id: string; name: string }
interface Company { id: string; name: string }

export default function Cotizador({ companies, sellers, userId }: { companies: Company[]; sellers: Seller[]; userId: string }) {
  const router = useRouter()

  // Datos de la cotización (los mismos que pide el formulario)
  const [companyId, setCompanyId] = useState(() => companies.find(c => /transccl/i.test(c.name))?.id ?? (companies.length === 1 ? companies[0].id : ''))
  const [sellerId, setSellerId] = useState(userId)
  const [cliente, setCliente] = useState<{ id: string; contactId: string | null; name: string; rut?: string } | null>(null)
  const [fechaRegreso, setFechaRegreso] = useState('')
  const [diasMes, setDiasMes] = useState('21')
  const [nombreRuta, setNombreRuta] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [tipoCliente, setTipoCliente] = useState('12')
  const [servicio, setServicio] = useState<Servicio>('salida')
  const [origen, setOrigen] = useState<PlaceSelection>(vacio)
  const [paradas, setParadas] = useState<PlaceSelection[]>([])
  const [destino, setDestino] = useState<PlaceSelection>(vacio)

  const [ruta, setRuta] = useState<{ clave: string; km: number | null; duracion: string | null; error: string }>({ clave: '', km: null, duracion: null, error: '' })
  const [kmManual, setKmManual] = useState('')

  const [pasajeros, setPasajeros] = useState('')
  const [formatoElegido, setFormatoElegido] = useState<FormatoId | null>(null)
  const [modalidad, setModalidad] = useState<Modalidad>('mismo_dia')
  const [fecha, setFecha] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [horaRegreso, setHoraRegreso] = useState('')
  const [precioPropuesto, setPrecioPropuesto] = useState('')

  const [calculo, setCalculo] = useState<{ resultado: ResultadoTarifa | null; error: string }>({ resultado: null, error: '' })
  const [recargosMarcados, setRecargosMarcados] = useState<Record<string, boolean>>({})
  const [referencia, setReferencia] = useState('')
  const [solicitudGuardada, setSolicitud] = useState<{ id: string; clave: string; status: string; decidido_por?: string; comentario?: string } | null>(null)
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Pasajeros → formato sugerido, salvo que la ejecutiva lo haya elegido a mano
  const formato: FormatoId = formatoElegido ?? (Number(pasajeros) > 0 ? formatoSugerido(Number(pasajeros)) : 'bus45')

  // Km por carretera: origen → paradas → destino (suma de tramos)
  const ids = useMemo(() => [origen, ...paradas, destino].map(p => p.placeId), [origen, paradas, destino])
  const rutaLista = ids.every(Boolean)
  const claveRuta = rutaLista ? ids.join('|') : ''
  useEffect(() => {
    if (!claveRuta) return
    let cancelado = false
    const sinRuta = 'No se pudo calcular la ruta en Google Maps. Ingresa los km a mano.'
    const lista = claveRuta.split('|')
    Promise.all(lista.slice(1).map((id, i) =>
      fetch(`/api/places?origin=${encodeURIComponent(lista[i])}&destination=${encodeURIComponent(id)}`).then(r => r.json())))
      .then(tramos => {
        if (cancelado) return
        if (tramos.some(t => !t.distance_m)) { setRuta({ clave: claveRuta, km: null, duracion: null, error: sinRuta }); return }
        const metros = tramos.reduce((s, t) => s + t.distance_m, 0)
        setRuta({ clave: claveRuta, km: Math.round(metros / 100) / 10, duracion: tramos.length === 1 ? tramos[0].duration_text ?? null : null, error: '' })
      })
      .catch(() => { if (!cancelado) setRuta({ clave: claveRuta, km: null, duracion: null, error: sinRuta }) })
    return () => { cancelado = true }
  }, [claveRuta])
  const rutaActual = claveRuta && ruta.clave === claveRuta ? ruta : null
  const kmMaps = rutaActual?.km ?? null
  const duracion = rutaActual?.duracion ?? null
  const errorKm = rutaActual?.error ?? ''
  const calculandoKm = !!claveRuta && !rutaActual

  const kmUsados = kmManual.trim() !== '' ? Number(kmManual.replace(',', '.')) : kmMaps

  // Cálculo con el motor del tarifario (servidor)
  const kmValido = kmUsados !== null && Number.isFinite(kmUsados) && kmUsados >= 0
  useEffect(() => {
    clearTimeout(timer.current)
    if (!kmValido) return
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/tarifa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servicio, km: kmUsados, formato,
            pasajeros: Number(pasajeros) || undefined,
            modalidad: servicio === 'salida' ? modalidad : undefined,
            fecha: fecha || undefined, horaSalida: horaSalida || undefined, horaRegreso: horaRegreso || undefined,
            precioPropuesto: Number(precioPropuesto.replace(/\D/g, '')) || undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setCalculo({ resultado: null, error: json.error ?? 'No se pudo calcular el precio' }); return }
        setCalculo({ resultado: json.data, error: '' })
      } catch { setCalculo({ resultado: null, error: 'No se pudo calcular el precio' }) }
    }, 250)
  }, [kmValido, servicio, kmUsados, formato, pasajeros, modalidad, fecha, horaSalida, horaRegreso, precioPropuesto])
  const resultado = kmValido ? calculo.resultado : null
  const errorTarifa = kmValido ? calculo.error : ''

  const unidad = servicio === 'contrato' ? 'por tramo' : 'por vehículo'
  const recargosPorAprobar = resultado?.alertas.filter(a => a.requiereAprobacion) ?? []
  const avisos = resultado?.alertas.filter(a => !a.requiereAprobacion) ?? []
  const comunaTxt = (p: PlaceSelection) => p.comuna ? ` (${p.comuna})` : ''

  function resumen(): string {
    if (!resultado) return ''
    const f = FORMATOS.find(x => x.id === resultado.formato.id)?.label ?? resultado.formato.nombre
    const lineas = [
      `Cotizador TransCCL — ${TIPOS_CLIENTE.find(t => t.pipeline === tipoCliente)?.label}`,
      `${servicio === 'contrato' ? 'Contrato mensual (tramo)' : MODALIDADES.find(m => m.id === modalidad)?.label}: ${origen.address}${comunaTxt(origen)} → ${destino.address}${comunaTxt(destino)}`,
      ...(paradas.length ? [`Paradas: ${paradas.map(p => p.address + comunaTxt(p)).join(' · ')}`] : []),
      `${kmUsados} km${kmManual ? ' (ajustados a mano)' : ''} · ${f}${resultado.vehiculos > 1 ? ` × ${resultado.vehiculos}` : ''}`,
      resultado.aMedida ? 'A medida' : `Lista ${formatCLP(resultado.precioLista!)} · Mínimo sin aprobación ${formatCLP(resultado.precioMinimo!)}${resultado.precioPiso ? ` · Piso con aprobación ${formatCLP(resultado.precioPiso)}` : ''} (${unidad})`,
      ...(resultado.propuesta ? [`Precio propuesto ${formatCLP(resultado.propuesta.precio)}: ${resultado.propuesta.motivo}`] : []),
      ...recargosPorAprobar.filter(a => recargosMarcados[a.tipo]).map(a => `Pedir aprobación: ${a.mensaje}${a.sugerido ? ` (sugerido ${a.sugerido})` : ''}`),
    ]
    return lineas.join('\n')
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(resumen()); toast.success('Resumen copiado') }
    catch { toast.error('No se pudo copiar') }
  }

  // ── Solicitud de aprobación ──
  const recargosPedidos = recargosPorAprobar.filter(a => recargosMarcados[a.tipo])
  const pideDescuento = !!resultado?.propuesta?.requiereAprobacion && !!resultado.propuesta.permitido
  const necesitaAprobacion = !!resultado && (pideDescuento || recargosPedidos.length > 0 || resultado.aMedida)
  // La solicitud vale solo para el viaje y el precio con que se pidió
  const claveSolicitud = JSON.stringify([servicio, kmUsados, formato, modalidad, resultado?.propuesta?.precio ?? null, recargosPedidos.map(r => r.tipo)])
  const solicitud = solicitudGuardada && solicitudGuardada.clave === claveSolicitud ? solicitudGuardada : null
  const tipoSolicitud = resultado?.aMedida ? 'a_medida' : pideDescuento && recargosPedidos.length ? 'descuento_recargo' : pideDescuento ? 'descuento' : 'recargo'

  useEffect(() => {
    if (!solicitud || solicitud.status !== 'pendiente') return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/autorizaciones?id=${solicitud.id}`, { cache: 'no-store' })
        const json = await res.json()
        if (res.ok && json.data?.status && json.data.status !== 'pendiente') {
          setSolicitud({ ...solicitud, status: json.data.status, decidido_por: json.data.decided_by_name, comentario: json.data.comentario })
        }
      } catch { /* se reintenta en el próximo ciclo */ }
    }, 20000)
    return () => clearInterval(id)
  }, [solicitud])

  async function solicitarAprobacion() {
    if (!resultado) return
    if (!referencia.trim()) { toast.error('Indica el cliente o una referencia'); return }
    setEnviandoSolicitud(true)
    try {
      const res = await fetch('/api/autorizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'create',
          tipo: tipoSolicitud,
          referencia: referencia.trim(),
          detalle: resumen(),
          precio_lista: resultado.precioLista,
          precio_minimo: resultado.precioMinimo,
          precio_solicitado: pideDescuento ? resultado.propuesta!.precio : null,
          recargos: recargosPedidos,
          payload: {
            entrada: { servicio, tipoCliente, km: kmUsados, kmManual: kmManual !== '', formato, pasajeros, modalidad, fecha, horaSalida, horaRegreso,
              origen: origen.address, destino: destino.address, paradas: paradas.map(p => p.address) },
            resultado,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo enviar la solicitud'); return }
      setSolicitud({ id: json.data.id, clave: claveSolicitud, status: 'pendiente' })
      toast.success('Solicitud enviada a Claudio, Claudia y Paola')
    } catch { toast.error('No se pudo enviar la solicitud') }
    finally { setEnviandoSolicitud(false) }
  }

  const corto = (p: PlaceSelection) => p.comuna ?? p.address.split(',')[0]

  function crearCotizacion() {
    if (!resultado || resultado.aMedida || kmUsados === null) return
    if (!cliente) { toast.error('Busca o crea el cliente por RUT'); return }
    if (!sellerId) { toast.error('Selecciona el vendedor'); return }
    if (necesitaAprobacion && solicitud?.status !== 'aprobada') {
      toast.error(solicitud?.status === 'pendiente' ? 'La aprobación todavía está pendiente' : 'Primero solicita la aprobación')
      return
    }
    const f = resultado.formato.id
    const cod = CODIGO_FORMATO[f]
    const precio = resultado.propuesta?.precio ?? resultado.precioLista!
    const hora = (h: string, def: string) => h || def
    const fechaSalida = fecha ? `${fecha}T${hora(horaSalida, '09:00')}` : ''
    const diaRetorno = servicio === 'salida' && modalidad === 'otro_dia' ? fechaRegreso : fecha
    const fechaRetorno = diaRetorno && modalidad !== 'solo_ida' ? `${diaRetorno}T${hora(horaRegreso, '15:00')}` : ''
    const modalidadTxt = MODALIDADES.find(m => m.id === modalidad)?.label.toLowerCase()
    const formatoTxt = FORMATOS.find(x => x.id === f)?.label ?? resultado.formato.nombre
    const description = servicio === 'contrato'
      ? `${formatoTxt} – ${corto(origen)} → ${corto(destino)}`
      : `${formatoTxt} – ${corto(origen)} → ${corto(destino)}, ${modalidadTxt}${modalidad === 'mismo_dia' ? ' (deja y retira)' : ''}`
    const nota = [
      `Tarifario TransCCL ${resultado.version}: lista ${formatCLP(resultado.precioLista!)}, mínimo sin aprobación ${formatCLP(resultado.precioMinimo!)}` +
        (resultado.precioPiso ? `, piso ${formatCLP(resultado.precioPiso)}` : '') + ` (${unidad}).`,
      `${kmUsados} km${kmManual ? ' ajustados a mano' : ' por carretera'}` + (paradas.length ? `, paradas: ${paradas.map(p => p.address).join(' · ')}` : '') + '.',
      ...(solicitud?.status === 'aprobada' ? [`Aprobado por ${solicitud.decidido_por}${solicitud.comentario ? `: "${solicitud.comentario}"` : ''} (autorización ${solicitud.id.slice(0, 8)}).`] : []),
      ...recargosPedidos.map(r => `Recargo pedido: ${r.mensaje}${r.sugerido ? ` (sugerido ${r.sugerido})` : ''}`),
    ].join('\n')

    guardarHandoff({
      version: 1,
      companyId: companyId || undefined,
      sellerId,
      clientId: cliente.id,
      contactId: cliente.contactId,
      clientName: cliente.name,
      clientRut: cliente.rut,
      pipelineId: servicio === 'contrato' ? PIPELINE_CONTRATO : tipoCliente,
      vehicleType: cod.vehicleType,
      desde: origen.address,
      hasta: destino.address,
      destinoLat: destino.lat,
      destinoLng: destino.lng,
      km: kmUsados,
      fechaSalida,
      fechaRetorno,
      observaciones: [observaciones.trim(), nota].filter(Boolean).join('\n\n'),
      autorizacionId: solicitud?.status === 'aprobada' ? solicitud.id : undefined,
      item: {
        codigo: cod.codigo,
        description,
        pasajeros: Number(pasajeros) || resultado.formato.pasajeros,
        quantity: servicio === 'contrato' ? (Number(diasMes) || 21) : resultado.vehiculos,
        unit_price: precio,
        ...(servicio === 'contrato' ? {
          ruta_nombre: nombreRuta.trim() || `${corto(origen)} → ${corto(destino)}`,
          desde_item: origen.address,
          hasta_item: destino.address,
          hora_salida_item: horaSalida,
          hora_retorno_item: horaRegreso,
          tiene_paradas: paradas.length > 0,
          obs_paradas: paradas.map(p => p.address).join(' · '),
        } : {}),
      },
      tarifa: { servicio, formato: f, km: kmUsados, modalidad: servicio === 'salida' ? modalidad : undefined },
    })
    router.push('/cotizaciones/nueva?desde_cotizador=1')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      {/* ── Datos del viaje ── */}
      <div className="space-y-5">
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Empresa y vendedor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="empresa">Empresa</Label>
              <select id="empresa" className={SELECT_CLS} value={companyId} onChange={e => setCompanyId(e.target.value)}>
                <option value="">Seleccionar empresa…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendedor">Vendedor</Label>
              <select id="vendedor" className={SELECT_CLS} value={sellerId} onChange={e => setSellerId(e.target.value)}>
                <option value="">Seleccionar vendedor…</option>
                {sellers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Cliente</h2>
          <ClientRutSearch onSelect={(id, contactId, info) => setCliente({ id, contactId, name: info?.name ?? '', rut: info?.rut })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tipo-cliente">Tipo de cliente</Label>
              <select id="tipo-cliente" className={SELECT_CLS} value={tipoCliente} onChange={e => setTipoCliente(e.target.value)}>
                {TIPOS_CLIENTE.map(t => <option key={t.pipeline} value={t.pipeline}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <div className="grid grid-cols-2 gap-2">
                {([['salida', 'Salida / viaje'], ['contrato', 'Contrato mensual']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setServicio(v)}
                    className="h-9 rounded-md border text-sm font-medium transition-colors"
                    style={servicio === v ? { background: '#1B8A4B', color: 'white', borderColor: '#1B8A4B' } : {}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Recorrido</h2>
          <div className="space-y-1.5">
            <Label htmlFor="origen">{servicio === 'contrato' ? 'Primera recogida (dirección exacta)' : 'Salida (dirección exacta del colegio o cliente)'}</Label>
            <AddressInput id="origen" value={origen} onChange={setOrigen} placeholder="Calle, número y comuna" />
            {origen.comuna && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />Comuna: {origen.comuna}</p>}
          </div>

          {paradas.map((p, i) => (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={`parada-${i}`}>Parada {i + 1}</Label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <AddressInput id={`parada-${i}`} value={p} onChange={sel => setParadas(prev => prev.map((x, j) => j === i ? sel : x))} placeholder="Dirección de la parada" />
                </div>
                <Button type="button" variant="outline" size="icon" title="Quitar parada"
                  onClick={() => setParadas(prev => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {p.comuna && <p className="text-xs text-gray-500">Comuna: {p.comuna}</p>}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setParadas(prev => [...prev, vacio])}>
            <Plus className="h-4 w-4 mr-1" />Agregar parada
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="destino">Destino</Label>
            <AddressInput id="destino" value={destino} onChange={setDestino} placeholder="Lugar o dirección de destino" />
            {destino.comuna && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />Comuna: {destino.comuna}</p>}
          </div>

          <div className="rounded-lg bg-gray-50 border p-3 grid gap-3 sm:grid-cols-2 items-end">
            <div>
              <div className="text-xs font-semibold uppercase text-gray-500">{servicio === 'contrato' ? 'Km del tramo (con paradas)' : 'Km de ida'} según Google Maps</div>
              <div className="text-lg font-bold tabular-nums">
                {calculandoKm ? 'Calculando…' : kmMaps !== null ? `${kmMaps.toLocaleString('es-CL')} km` : '—'}
                {duracion && <span className="text-sm font-normal text-gray-500 ml-2">{duracion}</span>}
              </div>
              {errorKm && <p className="text-xs text-red-600">{errorKm}</p>}
              {kmMaps === null && !errorKm && <p className="text-xs text-gray-500">Elige las direcciones desde las sugerencias de Google.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="km-manual">Ajustar km a mano (opcional)</Label>
              <Input id="km-manual" inputMode="decimal" value={kmManual} onChange={e => setKmManual(e.target.value)} placeholder="Ej. 42,5" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Vehículo y horario</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pasajeros">Pasajeros</Label>
              <Input id="pasajeros" inputMode="numeric" value={pasajeros} onChange={e => setPasajeros(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="formato">Formato del vehículo</Label>
              <select id="formato" className={SELECT_CLS} value={formato}
                onChange={e => setFormatoElegido(e.target.value as FormatoId)}>
                {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {servicio === 'salida' && (
            <div className="space-y-1.5">
              <Label>Modalidad</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODALIDADES.map(m => (
                  <button key={m.id} type="button" onClick={() => setModalidad(m.id)}
                    className="rounded-md border px-3 py-2 text-left transition-colors"
                    style={modalidad === m.id ? { background: '#E8F5EE', borderColor: '#1B8A4B' } : {}}>
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-xs text-gray-500">{m.ayuda}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fecha">{servicio === 'contrato' ? 'Inicio del contrato' : 'Fecha'}</Label>
              <Input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora-salida">Hora de salida</Label>
              <Input id="hora-salida" type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora-regreso">Hora de regreso</Label>
              <Input id="hora-regreso" type="time" value={horaRegreso} onChange={e => setHoraRegreso(e.target.value)} />
            </div>
          </div>

          {servicio === 'salida' && modalidad === 'otro_dia' && (
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="fecha-regreso">Fecha de regreso</Label>
              <Input id="fecha-regreso" type="date" value={fechaRegreso} onChange={e => setFechaRegreso(e.target.value)} />
            </div>
          )}

          {servicio === 'contrato' && (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="nombre-ruta">Nombre de la ruta</Label>
                <Input id="nombre-ruta" value={nombreRuta} onChange={e => setNombreRuta(e.target.value)} placeholder="Ej. Metro Pajaritos → CD Salcobrand (AM)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dias-mes">Días al mes</Label>
                <Input id="dias-mes" inputMode="numeric" value={diasMes} onChange={e => setDiasMes(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-2">
          <Label htmlFor="observaciones">Observaciones para la cotización</Label>
          <textarea id="observaciones" rows={3} value={observaciones} onChange={e => setObservaciones(e.target.value)}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30"
            placeholder="Condiciones especiales, paradas, horarios, etc. Se agrega una nota con el cálculo del tarifario." />
        </section>
      </div>

      {/* ── Resultado ── */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Precio</h2>
          {errorTarifa && <p className="text-sm text-red-600">{errorTarifa}</p>}
          {!resultado && !errorTarifa && (
            <p className="text-sm text-gray-500">Ingresa salida y destino desde las sugerencias de Google (o los km a mano) y aparece el precio.</p>
          )}
          {resultado?.aMedida && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Este tramo supera los 50 km: se cotiza a medida con Claudio, Claudia o Paola.
            </div>
          )}
          {resultado && !resultado.aMedida && (
            <>
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500">Precio lista {unidad}</div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: '#1B8A4B' }}>{formatCLP(resultado.precioLista!)}</div>
                {resultado.vehiculos > 1 && (
                  <div className="text-sm text-gray-600">{resultado.vehiculos} vehículos: {formatCLP(resultado.precioLista! * resultado.vehiculos)}</div>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-xs text-gray-500">Mínimo sin aprobación</dt>
                  <dd className="font-semibold tabular-nums">{formatCLP(resultado.precioMinimo!)}</dd>
                </div>
                {resultado.precioPiso !== null ? (
                  <div className="rounded-lg bg-gray-50 p-2">
                    <dt className="text-xs text-gray-500">Piso con aprobación</dt>
                    <dd className="font-semibold tabular-nums">{formatCLP(resultado.precioPiso)}</dd>
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 p-2">
                    <dt className="text-xs text-gray-500">Formato</dt>
                    <dd className="font-semibold">{resultado.formato.nombre}</dd>
                  </div>
                )}
              </dl>

              <div className="space-y-1.5">
                <Label htmlFor="precio-propuesto">Precio que quieres ofrecer (opcional)</Label>
                <Input id="precio-propuesto" inputMode="numeric" value={precioPropuesto}
                  onChange={e => setPrecioPropuesto(e.target.value.replace(/\D/g, ''))} placeholder={String(resultado.precioLista)} />
                {resultado.propuesta && (
                  <div className={`flex gap-2 items-start rounded-md p-2 text-sm ${!resultado.propuesta.permitido ? 'bg-red-50 text-red-800' : resultado.propuesta.requiereAprobacion ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
                    {!resultado.propuesta.permitido ? <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      : resultado.propuesta.requiereAprobacion ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{resultado.propuesta.motivo}</span>
                  </div>
                )}
              </div>

              <ul className="text-xs text-gray-500 space-y-0.5">
                {resultado.detalle.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
        </section>

        {resultado && (recargosPorAprobar.length > 0 || avisos.length > 0) && (
          <section className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Avisos</h2>
            {recargosPorAprobar.length > 0 && (
              <p className="text-xs text-gray-500">No se suman al precio. Marca los que quieres pedir a Claudio, Claudia o Paola.</p>
            )}
            {recargosPorAprobar.map(a => (
              <label key={a.tipo} className="flex gap-2 items-start text-sm cursor-pointer">
                <input type="checkbox" className="mt-1" checked={!!recargosMarcados[a.tipo]}
                  onChange={e => setRecargosMarcados(prev => ({ ...prev, [a.tipo]: e.target.checked }))} />
                <span>{a.mensaje}{a.sugerido && <span className="text-gray-500"> Sugerido: {a.sugerido}.</span>}</span>
              </label>
            ))}
            {avisos.map(a => (
              <p key={a.tipo} className="flex gap-2 items-start text-sm text-gray-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />{a.mensaje}
              </p>
            ))}
          </section>
        )}

        {resultado && (necesitaAprobacion || solicitud) && (
          <section className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Aprobación</h2>
            {!solicitud && (
              <>
                <p className="text-sm text-gray-600">
                  {resultado.aMedida ? 'Este viaje se cotiza a medida.'
                    : pideDescuento && recargosPedidos.length ? 'El precio queda bajo el mínimo y marcaste recargos.'
                      : pideDescuento ? 'El precio que quieres ofrecer queda bajo el mínimo.'
                        : 'Marcaste recargos para cobrar.'}
                  {' '}Lo aprueba Claudio, Claudia o Paola.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="referencia">Cliente o referencia</Label>
                  <Input id="referencia" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej. Colegio Santa Victoria, salida 12-11" />
                </div>
                <Button type="button" className="w-full" disabled={enviandoSolicitud} onClick={solicitarAprobacion}>
                  {enviandoSolicitud ? 'Enviando…' : 'Solicitar aprobación'}
                </Button>
              </>
            )}
            {solicitud?.status === 'pendiente' && (
              <p className="text-sm text-amber-800 bg-amber-50 rounded-md p-2">
                Solicitud enviada. Esperando aprobación; puedes seguirla en <a href="/autorizaciones" className="underline">Por aprobar</a>.
              </p>
            )}
            {solicitud && solicitud.status !== 'pendiente' && (
              <p className={`text-sm rounded-md p-2 ${solicitud.status === 'aprobada' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {solicitud.status === 'aprobada' ? 'Aprobada' : solicitud.status === 'rechazada' ? 'Rechazada' : 'Anulada'}
                {solicitud.decidido_por && ` por ${solicitud.decidido_por}`}{solicitud.comentario && `: “${solicitud.comentario}”`}
              </p>
            )}
          </section>
        )}

        {resultado && !resultado.aMedida && (
          <div className="grid gap-2">
            <Button type="button" onClick={crearCotizacion} style={{ background: '#1B8A4B' }}>
              <FilePlus2 className="h-4 w-4 mr-1" />Crear cotización con estos datos
            </Button>
            <Button type="button" variant="outline" onClick={copiar}>
              <Copy className="h-4 w-4 mr-1" />Copiar resumen
            </Button>
          </div>
        )}
      </aside>
    </div>
  )
}
