// ── Tarifario TransCCL ───────────────────────────────────────────────────────
// Fuente única de precios para el Cotizador, el formulario de cotización y el bot.
// Reglas acordadas con Claudio el 01-11-2026. Valores por vehículo, exentos de IVA,
// conductor incluido, peajes aparte. Ningún recargo se aplica solo: se avisan y los
// aprueba TransCCL (Claudio, Claudia o Paola).

export type Servicio = 'salida' | 'contrato'
export type Modalidad = 'mismo_dia' | 'otro_dia' | 'solo_ida' | 'a_disposicion'
export type FormatoId = 'bus45' | 'taxibus30' | 'taxibus25' | 'minibus19' | 'minibus17' | 'minibus15' | 'van11'

export interface Formato {
  id: FormatoId
  nombre: string
  pasajeros: number
  salida: {
    minimo: number        // precio lista mínimo (cubre los primeros km de ida)
    fijo: number          // precio lista = máx(minimo, fijo + valorKm × km de ida)
    valorKm: number       // $ por km de ida
    disposicion: number   // recargo si el vehículo queda a disposición del grupo
  }
  contrato: {
    costoTramo: number    // costo del socio por tramo (AM o PM) hasta 20 km
    estimado: boolean     // true si no hay contratos reales de este formato
  }
}

const KM_INCLUIDOS_ESCALERA = 19

function escalera(minimo: number) {
  return { minimo, fijo: minimo - KM_INCLUIDOS_ESCALERA * 3100, valorKm: 3100 }
}

export const TARIFARIO = {
  version: '2026-11-01',
  formatos: [
    { id: 'bus45', nombre: 'Bus 45', pasajeros: 45,
      salida: { minimo: 184500, fijo: 118500, valorKm: 3560, disposicion: 100000 },
      contrato: { costoTramo: 64750, estimado: false } },
    { id: 'taxibus30', nombre: 'Taxibús 30', pasajeros: 30,
      salida: { ...escalera(175800), disposicion: 90000 },
      contrato: { costoTramo: 60000, estimado: false } },
    { id: 'taxibus25', nombre: 'Taxibús 25', pasajeros: 25,
      salida: { ...escalera(167800), disposicion: 90000 },
      contrato: { costoTramo: 55000, estimado: true } },
    { id: 'minibus19', nombre: 'Minibús 19', pasajeros: 19,
      salida: { ...escalera(159100), disposicion: 90000 },
      contrato: { costoTramo: 42500, estimado: false } },
    { id: 'minibus17', nombre: 'Minibús 17', pasajeros: 17,
      salida: { ...escalera(151100), disposicion: 80000 },
      contrato: { costoTramo: 40000, estimado: true } },
    { id: 'minibus15', nombre: 'Minibús 15', pasajeros: 15,
      salida: { ...escalera(142400), disposicion: 80000 },
      contrato: { costoTramo: 34750, estimado: false } },
    { id: 'van11', nombre: 'Van 11', pasajeros: 11,
      salida: { ...escalera(134400), disposicion: 80000 },
      contrato: { costoTramo: 32500, estimado: false } },
  ] as Formato[],
  salida: {
    margenLista: 0.35,
    margenMinimo: 0.30,     // hasta aquí baja la ejecutiva sin pedir aprobación
    factorOtroDia: 1.5,     // el día completo + medio servicio
    kmRevisar: 150,         // sobre esto: revisar alojamiento / conductor de relevo
    kmPeajes: 50,           // sobre esto se avisa que hay peajes de ruta
  },
  contrato: {
    margenLista: 0.35,
    margenEjecutiva: 0.30,  // la ejecutiva baja hasta aquí
    margenPiso: 0.25,       // de 30% a 25% solo con aprobación; bajo 25% no se ofrece
    bandas: [
      { hastaKm: 20, factor: 1.0 },
      { hastaKm: 35, factor: 1.1 },
      { hastaKm: 50, factor: 1.2 },
    ],
  },
  recargos: {
    nocturno: { pct: 0.20, desde: '22:00', hasta: '06:00' },
    feriadoIrrenunciable: { pct: 0.25 },
    esperaFraccion30Min: { bus45: 10000, otros: 7000 },
  },
}

// Feriados irrenunciables (fechas fijas por ley). Los feriados móviles no se
// calculan aquí: los marca la ejecutiva si corresponde.
const IRRENUNCIABLES_MMDD = ['01-01', '05-01', '09-18', '09-19', '12-25']
const FERIADOS_FIJOS_MMDD = ['05-21', '07-16', '08-15', '11-01', '12-08']

function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}

export function tipoDia(fecha: string): 'irrenunciable' | 'feriado' | 'domingo' | 'normal' {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return 'normal'
  const mmdd = `${m[2]}-${m[3]}`
  if (IRRENUNCIABLES_MMDD.includes(mmdd)) return 'irrenunciable'
  const p = pascua(Number(m[1]))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const viernes = new Date(p.getTime() - 2 * 86400000), sabado = new Date(p.getTime() - 86400000)
  if (FERIADOS_FIJOS_MMDD.includes(mmdd) || fecha === iso(viernes) || fecha === iso(sabado)) return 'feriado'
  if (new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0) return 'domingo'
  return 'normal'
}

function enHorarioNocturno(hora?: string): boolean {
  if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) return false
  const [h, mi] = hora.split(':').map(Number)
  const min = h * 60 + mi
  return min >= 22 * 60 || min < 6 * 60
}

// Nunca se redondea a $100 ni $500 (Claudio, 01-11-2026): solo a pesos enteros.
// Si se quiere un monto redondo, lo ajusta la ejecutiva a mano.
const pesos = (v: number) => Math.round(v)

export function formatoPorPasajeros(pasajeros: number): Formato {
  const ordenados = [...TARIFARIO.formatos].sort((a, b) => a.pasajeros - b.pasajeros)
  return ordenados.find(f => f.pasajeros >= pasajeros) ?? ordenados[ordenados.length - 1]
}

export function getFormato(id: FormatoId): Formato | undefined {
  return TARIFARIO.formatos.find(f => f.id === id)
}

// ── Entrada y resultado ──────────────────────────────────────────────────────

export interface EntradaTarifa {
  servicio: Servicio
  km: number                  // salida: km de ida; contrato: km del tramo con paradas
  formato?: FormatoId         // si no viene, se elige por pasajeros
  pasajeros?: number
  modalidad?: Modalidad       // solo salidas; por defecto mismo día
  fecha?: string              // YYYY-MM-DD
  horaSalida?: string         // HH:MM
  horaRegreso?: string        // HH:MM
  precioPropuesto?: number    // precio por vehículo (salida) o por tramo (contrato) que quiere ofrecer la ejecutiva
}

export interface Alerta {
  tipo: 'nocturno' | 'feriado_irrenunciable' | 'feriado' | 'domingo' | 'peajes' | 'distancia' | 'a_medida' | 'formato_estimado' | 'pasajeros'
  mensaje: string
  sugerido?: string           // valor sugerido, solo informativo
  requiereAprobacion: boolean
}

export interface ResultadoTarifa {
  version: string
  servicio: Servicio
  formato: { id: FormatoId; nombre: string; pasajeros: number }
  vehiculos: number
  km: number
  modalidad?: Modalidad
  aMedida: boolean
  precioLista: number | null      // por vehículo (salida) o por tramo (contrato)
  precioMinimo: number | null     // lo más bajo que ofrece la ejecutiva sin aprobación
  precioPiso: number | null       // contratos: lo más bajo con aprobación (25%)
  costoEstimado: number | null    // costo del socio estimado
  banda?: { desdeKm: number; hastaKm: number; factor: number }
  propuesta?: {
    precio: number
    margenEstimado: number | null
    requiereAprobacion: boolean
    permitido: boolean            // false si queda bajo el piso de contratos
    motivo: string
  }
  alertas: Alerta[]
  detalle: string[]
}

export function calcularTarifa(e: EntradaTarifa): ResultadoTarifa {
  const km = Math.max(0, Number(e.km) || 0)
  const pasajeros = e.pasajeros && e.pasajeros > 0 ? e.pasajeros : undefined
  const formato = (e.formato && getFormato(e.formato)) || formatoPorPasajeros(pasajeros ?? 45)
  const vehiculos = pasajeros && pasajeros > formato.pasajeros ? Math.ceil(pasajeros / formato.pasajeros) : 1
  const alertas: Alerta[] = []
  const detalle: string[] = []

  if (pasajeros && pasajeros > formato.pasajeros) {
    alertas.push({ tipo: 'pasajeros', requiereAprobacion: false,
      mensaje: `${pasajeros} pasajeros no caben en un ${formato.nombre}: se cotizan ${vehiculos} vehículos.` })
  }

  const base = {
    version: TARIFARIO.version,
    servicio: e.servicio,
    formato: { id: formato.id, nombre: formato.nombre, pasajeros: formato.pasajeros },
    vehiculos,
    km,
  }

  let resultado: ResultadoTarifa

  if (e.servicio === 'contrato') {
    const C = TARIFARIO.contrato
    let desde = 0
    const banda = C.bandas.find(b => { const ok = km <= b.hastaKm; if (!ok) desde = b.hastaKm; return ok })
    if (!banda) {
      alertas.push({ tipo: 'a_medida', requiereAprobacion: true,
        mensaje: `Tramo de ${km} km: sobre ${C.bandas[C.bandas.length - 1].hastaKm} km se cotiza a medida.` })
      resultado = { ...base, aMedida: true, precioLista: null, precioMinimo: null, precioPiso: null, costoEstimado: null, alertas, detalle }
    } else {
      const costo = formato.contrato.costoTramo * banda.factor
      const lista = pesos(costo / (1 - C.margenLista))
      const minimo = pesos(costo / (1 - C.margenEjecutiva))
      const piso = pesos(costo / (1 - C.margenPiso))
      detalle.push(`Costo socio por tramo ${formato.nombre}: $${formato.contrato.costoTramo.toLocaleString('es-CL')}` +
        (banda.factor !== 1 ? ` × ${banda.factor} (banda ${desde}–${banda.hastaKm} km)` : ` (banda hasta ${banda.hastaKm} km)`))
      detalle.push(`Lista 35%: $${lista.toLocaleString('es-CL')} · Ejecutiva 30%: $${minimo.toLocaleString('es-CL')} · Piso 25% (con aprobación): $${piso.toLocaleString('es-CL')}`)
      if (formato.contrato.estimado) {
        alertas.push({ tipo: 'formato_estimado', requiereAprobacion: false,
          mensaje: `El costo del ${formato.nombre} es estimado: no hay contratos reales de este formato.` })
      }
      resultado = { ...base, aMedida: false, precioLista: lista, precioMinimo: minimo, precioPiso: piso,
        costoEstimado: Math.round(costo), banda: { desdeKm: desde, hastaKm: banda.hastaKm, factor: banda.factor }, alertas, detalle }
    }
  } else {
    const S = TARIFARIO.salida
    const modalidad: Modalidad = e.modalidad ?? 'mismo_dia'
    const f = formato.salida
    const listaDia = pesos(Math.max(f.minimo, f.fijo + f.valorKm * km))
    const factorMin = (1 - S.margenLista) / (1 - S.margenMinimo)
    const minimoDia = pesos(listaDia * factorMin)
    let lista: number, minimo: number
    if (modalidad === 'otro_dia') {
      lista = pesos(listaDia * S.factorOtroDia)
      minimo = pesos(lista * factorMin)
    } else if (modalidad === 'solo_ida') {
      lista = minimoDia
      minimo = minimoDia
    } else if (modalidad === 'a_disposicion') {
      lista = listaDia + f.disposicion
      minimo = minimoDia + f.disposicion
    } else {
      lista = listaDia
      minimo = minimoDia
    }
    detalle.push(listaDia === f.minimo
      ? `${formato.nombre} mismo día: mínimo $${f.minimo.toLocaleString('es-CL')} (${km} km de ida)`
      : `${formato.nombre} mismo día: $${f.fijo.toLocaleString('es-CL')} + $${f.valorKm.toLocaleString('es-CL')} × ${km} km = $${listaDia.toLocaleString('es-CL')}`)
    if (modalidad === 'otro_dia') detalle.push(`Regreso otro día: × ${S.factorOtroDia}`)
    if (modalidad === 'solo_ida') detalle.push('Solo ida: precio mínimo del mismo día, sin descuento adicional')
    if (modalidad === 'a_disposicion') detalle.push(`A disposición: + $${f.disposicion.toLocaleString('es-CL')}`)

    if (km > S.kmPeajes) alertas.push({ tipo: 'peajes', requiereAprobacion: false,
      mensaje: 'Viaje interurbano: los peajes de ruta se suman aparte.' })
    if (km > S.kmRevisar) alertas.push({ tipo: 'distancia', requiereAprobacion: true,
      mensaje: `Más de ${S.kmRevisar} km de ida: revisar alojamiento y conductor de relevo.` })

    resultado = { ...base, modalidad, aMedida: false, precioLista: lista, precioMinimo: minimo, precioPiso: null,
      // el socio cobra casi lo mismo por solo ida que por ida y regreso
      costoEstimado: Math.round((modalidad === 'solo_ida' ? listaDia : lista) * (1 - S.margenLista)), alertas, detalle }
  }

  // Recargos: solo se avisan, nunca se suman solos.
  const R = TARIFARIO.recargos
  if (enHorarioNocturno(e.horaSalida) || enHorarioNocturno(e.horaRegreso)) {
    alertas.push({ tipo: 'nocturno', requiereAprobacion: true, sugerido: `+${R.nocturno.pct * 100}%`,
      mensaje: `Horario nocturno (${R.nocturno.desde} a ${R.nocturno.hasta}): posible recargo.` })
  }
  if (e.fecha) {
    const t = tipoDia(e.fecha)
    if (t === 'irrenunciable') alertas.push({ tipo: 'feriado_irrenunciable', requiereAprobacion: true,
      sugerido: `+${R.feriadoIrrenunciable.pct * 100}%`, mensaje: 'Feriado irrenunciable: posible recargo.' })
    if (t === 'feriado') alertas.push({ tipo: 'feriado', requiereAprobacion: true,
      mensaje: 'Feriado: posible recargo, a definir por TransCCL.' })
    if (t === 'domingo') alertas.push({ tipo: 'domingo', requiereAprobacion: true,
      mensaje: 'Domingo: posible recargo, a definir por TransCCL.' })
  }

  if (e.precioPropuesto && e.precioPropuesto > 0 && resultado.precioMinimo !== null) {
    const p = e.precioPropuesto
    const costo = resultado.costoEstimado
    const margen = costo ? 1 - costo / p : null
    const piso = resultado.precioPiso
    let requiere = false, permitido = true, motivo = 'Dentro de lo que la ejecutiva puede ofrecer.'
    if (piso !== null && p < piso) {
      requiere = true; permitido = false
      motivo = 'Bajo el piso de 25%: no se puede ofrecer.'
    } else if (p < resultado.precioMinimo) {
      requiere = true
      motivo = piso !== null
        ? 'Bajo el 30%: necesita aprobación de Claudio, Claudia o Paola (piso 25%).'
        : 'Bajo el precio mínimo: necesita aprobación de Claudio, Claudia o Paola.'
    }
    resultado.propuesta = { precio: p, margenEstimado: margen !== null ? Math.round(margen * 1000) / 1000 : null,
      requiereAprobacion: requiere, permitido, motivo }
  }

  return resultado
}
