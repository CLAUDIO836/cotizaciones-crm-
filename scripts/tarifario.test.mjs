// Pruebas del tarifario con los ejemplos validados por Claudio (01-11-2026).
// Ejecutar: node --test scripts/tarifario.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularTarifa, formatoPorPasajeros, tipoDia } from '../lib/tarifario.ts'

const salida = (formato, km, extra = {}) => calcularTarifa({ servicio: 'salida', formato, km, ...extra })
const contrato = (formato, km, extra = {}) => calcularTarifa({ servicio: 'contrato', formato, km, ...extra })

test('bus 45 mismo día: mínimo y valor por km', () => {
  assert.equal(salida('bus45', 11).precioLista, 184500)
  assert.equal(salida('bus45', 11).precioMinimo, 171500)
  assert.equal(salida('bus45', 15.3).precioLista, 184500)          // San Bernardo → Buin Zoo
  assert.equal(salida('bus45', 41.7).precioLista, 267000)          // Ñuñoa → Buin Zoo
  assert.equal(salida('bus45', 87.3).precioLista, 429500)          // Santiago → Rancagua
  assert.ok(Math.abs(salida('bus45', 128.6).precioLista - 576500) <= 500) // Ñuñoa → Viña
})

test('escalera de formatos a $3.100 por km sobre 19 km', () => {
  assert.equal(salida('taxibus30', 11).precioLista, 175800)
  assert.equal(salida('taxibus25', 11).precioLista, 167800)
  assert.equal(salida('minibus19', 11).precioLista, 159100)
  assert.equal(salida('minibus17', 11).precioLista, 151100)
  assert.equal(salida('minibus15', 11).precioLista, 142400)
  assert.equal(salida('van11', 11).precioLista, 134400)
  assert.equal(salida('taxibus30', 42).precioLista, 247100)
  assert.equal(salida('minibus19', 129).precioLista, 500100)
  assert.equal(salida('van11', 42).precioLista, 205700)
})

test('modalidades de salida', () => {
  assert.equal(salida('bus45', 11, { modalidad: 'otro_dia' }).precioLista, 277000)   // 276.750 redondeado a $500
  assert.equal(salida('bus45', 11, { modalidad: 'solo_ida' }).precioLista, 171500)
  assert.equal(salida('bus45', 11, { modalidad: 'solo_ida' }).precioMinimo, 171500)
  assert.equal(salida('bus45', 11, { modalidad: 'a_disposicion' }).precioLista, 284500)
  assert.equal(salida('taxibus30', 11, { modalidad: 'a_disposicion' }).precioLista, 265800)
  assert.equal(salida('van11', 11, { modalidad: 'a_disposicion' }).precioLista, 214400)
})

test('contratos mensuales: tramo por banda y márgenes 35/30/25', () => {
  const b = contrato('bus45', 15)
  assert.deepEqual([b.precioLista, b.precioMinimo, b.precioPiso], [99500, 92500, 86500])
  assert.equal(contrato('bus45', 22).precioLista, 109500)
  assert.equal(contrato('bus45', 40).precioLista, 119500)
  assert.equal(contrato('taxibus30', 10).precioLista, 92500)
  assert.equal(contrato('minibus19', 10).precioLista, 65500)
  assert.equal(contrato('minibus19', 25).precioLista, 72000)
  assert.equal(contrato('minibus15', 10).precioLista, 53500)
  assert.equal(contrato('van11', 10).precioLista, 50000)
  assert.equal(contrato('van11', 30).precioLista, 55000)
  assert.equal(contrato('van11', 45).precioLista, 60000)
  const lejos = contrato('bus45', 60)
  assert.equal(lejos.aMedida, true)
  assert.equal(lejos.precioLista, null)
})

test('aprobaciones de precio propuesto', () => {
  assert.equal(contrato('bus45', 15, { precioPropuesto: 95000 }).propuesta.requiereAprobacion, false)
  const p = contrato('bus45', 15, { precioPropuesto: 90000 }).propuesta
  assert.equal(p.requiereAprobacion, true); assert.equal(p.permitido, true)
  assert.equal(contrato('bus45', 15, { precioPropuesto: 85000 }).propuesta.permitido, false)
  assert.equal(salida('bus45', 11, { precioPropuesto: 175000 }).propuesta.requiereAprobacion, false)
  assert.equal(salida('bus45', 11, { precioPropuesto: 165000 }).propuesta.requiereAprobacion, true)
})

test('recargos solo como alertas que requieren aprobación', () => {
  const tipos = r => r.alertas.map(a => a.tipo)
  assert.ok(tipos(salida('bus45', 11, { fecha: '2026-12-25' })).includes('feriado_irrenunciable'))
  assert.ok(tipos(salida('bus45', 11, { fecha: '2026-11-08' })).includes('domingo'))
  assert.ok(tipos(salida('bus45', 11, { horaRegreso: '23:00' })).includes('nocturno'))
  assert.ok(tipos(salida('bus45', 130)).includes('peajes'))
  const r = salida('bus45', 11, { fecha: '2026-12-25', horaSalida: '05:30' })
  assert.equal(r.precioLista, 184500)                                // el precio no cambia solo
  assert.ok(r.alertas.every(a => a.tipo === 'pasajeros' || a.requiereAprobacion))
  assert.equal(tipoDia('2026-04-03'), 'feriado')                     // Viernes Santo 2026
})

test('formato por pasajeros y vehículos', () => {
  assert.equal(formatoPorPasajeros(11).id, 'van11')
  assert.equal(formatoPorPasajeros(12).id, 'minibus15')
  assert.equal(formatoPorPasajeros(40).id, 'bus45')
  const r = calcularTarifa({ servicio: 'salida', km: 11, pasajeros: 80 })
  assert.equal(r.formato.id, 'bus45'); assert.equal(r.vehiculos, 2)
})
