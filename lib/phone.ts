/**
 * Chilean phone utilities.
 * Valid format: +56 followed by 9 digits (e.g. +56912345678 or +56212345678)
 * Mobile: +569XXXXXXXX  |  Landline: +562XXXXXXXX (or other area codes 2-8)
 */

export function validateChileanPhone(phone: string): boolean {
  const clean = phone.replace(/[\s\-\.\(\)]/g, '')
  return /^\+56[2-9]\d{8}$/.test(clean)
}

/** Normalize raw input to +56XXXXXXXXX while user types */
export function autoFormatPhone(raw: string): string {
  // digits only
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // already has country code
  if (digits.startsWith('56') && digits.length <= 11) return '+' + digits
  // just the local number (8-9 digits starting with 2-9)
  if (!digits.startsWith('56') && digits.length <= 9) return '+56' + digits
  return '+' + digits.slice(0, 11)
}

export function phoneError(phone: string): string {
  if (!phone.trim()) return 'El teléfono es obligatorio'
  if (!validateChileanPhone(phone)) return 'Formato inválido — usa +569XXXXXXXX (celular) o +562XXXXXXXX (fijo)'
  return ''
}
