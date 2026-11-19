'use client'

import { useState, useEffect } from 'react'

interface Quotation {
  id: string
  number: string | null
  total: number | null
  fecha_salida: string | null
  desde: string | null
  hasta: string | null
  client_name: string | null
  contact_email: string | null
  client_email: string | null
  seller_name: string | null
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

export default function BulkCartasPage() {
  const [from, setFrom] = useState('2026-01-01')
  const [quotations, setQuotations] = useState<Quotation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ id: string; ok: boolean; sent_to?: string; error?: string }[] | null>(null)
  const [error, setError] = useState('')

  async function loadList() {
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const r = await fetch(`/api/admin/bulk-cartas?from=${from}`)
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Error'); return }
      setQuotations(d.quotations ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function sendAll() {
    if (!quotations?.length) return
    const noEmail = quotations.filter(q => !q.contact_email && !q.client_email)
    if (noEmail.length) {
      setError(`⚠️ ${noEmail.length} cotización(es) sin email de contacto: ${noEmail.map(q => q.number ?? q.id).join(', ')}`)
    }
    const toSend = quotations.filter(q => q.contact_email || q.client_email)
    if (!toSend.length) return

    setSending(true)
    setError('')
    setResults(null)
    try {
      const r = await fetch('/api/admin/bulk-cartas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toSend.map(q => q.id) }),
      })
      const d = await r.json()
      setResults(d.results ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  useEffect(() => { loadList() }, [])

  const ok = results?.filter(r => r.ok).length ?? 0
  const fail = results?.filter(r => !r.ok).length ?? 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#082e62', margin: '0 0 4px' }}>
        Envío masivo — Cartas de Aprobación
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
        Envía la cotización + carta de aprobación a todos los clientes con servicios desde la fecha indicada (estado Ganado).
      </p>

      {/* Filtro fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Desde:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
        <button onClick={loadList} disabled={loading}
          style={{ padding: '8px 16px', background: '#082e62', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Cargando...' : 'Actualizar lista'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Resultados del envío */}
      {results && (
        <div style={{ padding: '12px 16px', background: ok === results.length ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${ok === results.length ? '#86efac' : '#fde68a'}`, borderRadius: 10, marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: ok === results.length ? '#166534' : '#92400e' }}>
            {ok === results.length ? '✅' : '⚠️'} Enviados: {ok} correctos, {fail} con error
          </p>
          {results.filter(r => !r.ok).map(r => (
            <p key={r.id} style={{ margin: '2px 0', fontSize: 12, color: '#991b1b' }}>
              ID {r.id.slice(0, 8)}…: {r.error}
            </p>
          ))}
          {results.filter(r => r.ok).map(r => (
            <p key={r.id} style={{ margin: '2px 0', fontSize: 12, color: '#166534' }}>
              ✓ {r.sent_to}
            </p>
          ))}
        </div>
      )}

      {/* Lista */}
      {quotations !== null && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#374151', fontWeight: 600 }}>
              {quotations.length} cotización{quotations.length !== 1 ? 'es' : ''} encontrada{quotations.length !== 1 ? 's' : ''}
            </p>
            {quotations.length > 0 && !results && (
              <button onClick={sendAll} disabled={sending}
                style={{ padding: '10px 20px', background: sending ? '#9ca3af' : '#16a34a', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? `Enviando... (puede tardar)` : `✉️ Enviar carta a los ${quotations.filter(q => q.contact_email || q.client_email).length} clientes`}
              </button>
            )}
          </div>

          {quotations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: '#f9fafb', borderRadius: 10, color: '#6b7280' }}>
              No hay cotizaciones ganadas desde esa fecha.
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    {['N°', 'Cliente', 'Email', 'Fecha servicio', 'Ruta', 'Total', 'Vendedor'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q, i) => {
                    const email = q.contact_email || q.client_email
                    const sent = results?.find(r => r.id === q.id)
                    return (
                      <tr key={q.id} style={{ background: sent?.ok ? '#f0fdf4' : sent?.error ? '#fef2f2' : i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#082e62' }}>
                          <a href={`/cotizaciones/${q.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#082e62' }}>
                            #{q.number ?? q.id.slice(0, 8)}
                          </a>
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{q.client_name ?? '—'}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: email ? '#1d4ed8' : '#ef4444' }}>
                          {email ?? '⚠️ Sin email'}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{q.fecha_salida?.slice(0, 10) ?? '—'}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280' }}>
                          {q.desde && q.hasta ? `${q.desde} → ${q.hasta}` : q.desde ?? q.hasta ?? '—'}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>
                          {q.total ? formatCLP(Number(q.total)) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{q.seller_name ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
