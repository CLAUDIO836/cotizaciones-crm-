import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function getStatusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    open: { label: 'Abierta', color: 'bg-blue-100 text-blue-800' },
    won: { label: 'Ganada', color: 'bg-green-100 text-green-800' },
    lost: { label: 'Perdida', color: 'bg-red-100 text-red-800' },
    active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
    expired: { label: 'Vencido', color: 'bg-gray-100 text-gray-800' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  }
  return map[status] ?? { label: status, color: 'bg-gray-100 text-gray-800' }
}

export function getMonthName(month: number): string {
  return new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(
    new Date(2024, month - 1, 1)
  )
}
