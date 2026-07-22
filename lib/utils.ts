import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatRut } from '@/lib/rut'

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
  return formatRut(rut)
}

export function formatDate(date: string | Date): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime()) || d.getFullYear() < 1980) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
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
