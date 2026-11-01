// Traspaso del Cotizador al formulario de cotización.
// Va por sessionStorage (no por la URL) para no dejar direcciones ni datos del
// cliente en el historial del navegador.

import type { FormatoId, Modalidad, Servicio } from '@/lib/tarifario'

export interface TarifaRef {
  servicio: Servicio
  formato: FormatoId
  km: number
  modalidad?: Modalidad
}

export interface CotizadorHandoff {
  version: 1
  companyId?: string
  sellerId?: string
  clientId: string
  contactId: string | null
  clientName: string
  clientRut?: string
  pipelineId: string
  vehicleType: 'bus' | 'taxibus' | 'minibus' | 'minivan'
  desde: string
  hasta: string
  destinoLat?: number
  destinoLng?: number
  km: number
  fechaSalida: string        // YYYY-MM-DDTHH:MM
  fechaRetorno: string       // YYYY-MM-DDTHH:MM
  observaciones: string
  autorizacionId?: string
  item: {
    codigo: string
    description: string
    pasajeros: number
    quantity: number
    unit_price: number
    // solo contratos
    ruta_nombre?: string
    desde_item?: string
    hasta_item?: string
    hora_salida_item?: string
    hora_retorno_item?: string
    tiene_paradas?: boolean
    obs_paradas?: string
  }
  tarifa: TarifaRef
}

const KEY = 'cotizador_handoff'

// Código de ítem y tarjeta de vehículo del formulario para cada formato
export const CODIGO_FORMATO: Record<FormatoId, { codigo: string; vehicleType: CotizadorHandoff['vehicleType'] }> = {
  bus45: { codigo: 'B45', vehicleType: 'bus' },
  taxibus30: { codigo: 'T30', vehicleType: 'taxibus' },
  taxibus25: { codigo: 'T25', vehicleType: 'taxibus' },
  minibus19: { codigo: 'M19', vehicleType: 'minibus' },
  minibus17: { codigo: 'M17', vehicleType: 'minibus' },
  minibus15: { codigo: 'M15', vehicleType: 'minibus' },
  van11: { codigo: 'V11', vehicleType: 'minivan' },
}

export function formatoPorCodigo(codigo: string | undefined): FormatoId | undefined {
  return (Object.keys(CODIGO_FORMATO) as FormatoId[]).find(f => CODIGO_FORMATO[f].codigo === codigo)
}

export function guardarHandoff(h: CotizadorHandoff) {
  sessionStorage.setItem(KEY, JSON.stringify(h))
}

// Se lee una sola vez: al abrir el formulario se borra
export function tomarHandoff(): CotizadorHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const h = JSON.parse(raw)
    return h?.version === 1 ? (h as CotizadorHandoff) : null
  } catch {
    return null
  }
}
