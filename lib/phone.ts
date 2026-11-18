/**
 * Chilean phone utilities.
 * Display format: +56 9 XXXX XXXX  (mobile)
 *                 +56 2 XXXX XXXX  (landline Santiago)
 * Stored the same way with spaces.
 */

/** Strip all spaces/dashes to get raw digits for validation */
function stripped(phone: string): string {
  return phone.replace(/[\s\-\.]/g, '')
}

export function validateChileanPhone(phone: string): boolean {
  return /^\+56[2-9]\d{8}$/.test(stripped(phone))
}

/**
 * Format raw input as +56 X XXXX XXXX while user types.
 * Accepts: "9 6535 5293", "56912345678", "+56 9 6535 5293", "912345678"
 */
export function autoFormatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return '+56 '

  // strip country code if present
  let local = digits.startsWith('56') ? digits.slice(2) : digits
  local = local.slice(0, 9) // max 9 local digits

  if (local.length === 0) return '+56 '
  if (local.length === 1) return `+56 ${local}`
  if (local.length <= 5) return `+56 ${local[0]} ${local.slice(1)}`
  return `+56 ${local[0]} ${local.slice(1, 5)} ${local.slice(5)}`
}

export const PHONE_DEFAULT_MOBILE   = '+56 9 '
export const PHONE_DEFAULT_LANDLINE = '+56 2 '

export function phoneError(phone: string): string {
  const val = phone.trim()
  if (!val || val === '+56 ' || val === PHONE_DEFAULT_MOBILE || val === PHONE_DEFAULT_LANDLINE) {
    return 'El teléfono es obligatorio'
  }
  if (!validateChileanPhone(val)) return 'Formato inválido — ej: +56 9 1234 5678'
  return ''
}
