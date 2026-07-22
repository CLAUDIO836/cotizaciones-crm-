/**
 * Utilidades centralizadas de RUT chileno.
 * Toda la lógica de validación, normalización y formato vive aquí.
 *
 * Formatos:
 *   Almacenado:  "76123456-K"   (sin puntos, con guion)
 *   Display:     "76.123.456-K" (con puntos, con guion)
 *   Comparación: "76123456K"    (sin puntos, sin guion, K mayúscula)
 */

/** Extrae solo dígitos y K (mayúscula) — para comparación interna. */
export function rutKey(raw: string): string {
  return raw.replace(/[^0-9kK]/g, '').toUpperCase()
}

/** Formato canónico para almacenar en base de datos: "76123456-K" */
export function normalizeRut(raw: string): string {
  const clean = rutKey(raw)
  if (clean.length < 2) return raw
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`
}

/** Formato visual para mostrar al usuario: "76.123.456-K" */
export function formatRut(raw: string): string {
  const clean = rutKey(raw)
  if (clean.length < 2) return raw
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

/**
 * Validación matemática módulo 11.
 * Acepta cualquier formato de entrada (con/sin puntos/guion).
 */
export function validateRut(raw: string): boolean {
  const clean = rutKey(raw)
  if (clean.length < 2) return false
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false
  const num = parseInt(body, 10)
  if (num < 1_000_000 || num > 99_999_999) return false
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const calc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === calc
}

/**
 * Formatea mientras el usuario escribe.
 * Devuelve formato display solo cuando el RUT tiene suficientes caracteres.
 */
export function autoFormatRut(raw: string): string {
  const clean = rutKey(raw)
  if (clean.length === 0) return ''
  if (clean.length <= 1) return clean
  return formatRut(raw)
}
