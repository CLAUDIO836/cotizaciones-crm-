'use client'

import { useState, useEffect } from 'react'

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

export default function LetterPaymentBadge({ quotationId, total }: { quotationId: string; total: number }) {
  const [totalPaid, setTotalPaid] = useState<number | null>(null)

  useEffect(() => {
    const load = () => {
      fetch(`/api/approval-letters/by-quotation?quotation_id=${quotationId}`)
        .then(r => r.json())
        .then(d => {
          const latest = d.letters?.[0]
          if (latest != null) setTotalPaid(Number(latest.total_paid ?? 0))
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [quotationId])

  if (totalPaid === null || totalPaid === 0) return null

  const isFullyPaid = total > 0 && totalPaid >= total
  const pending = total - totalPaid

  return (
    <div className="px-3 py-2.5 border-b" style={{ background: isFullyPaid ? '#dcfce7' : '#fffbeb' }}>
      {isFullyPaid ? (
        <>
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide">✅ PAGADO AL 100%</p>
          <p className="text-xs text-green-600">{formatCLP(totalPaid)} recibidos</p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pago parcial</p>
          <p className="text-xs text-amber-600">Recibido: {formatCLP(totalPaid)}</p>
          <p className="text-xs font-bold text-amber-700">Debe: {formatCLP(pending)}</p>
        </>
      )}
    </div>
  )
}
