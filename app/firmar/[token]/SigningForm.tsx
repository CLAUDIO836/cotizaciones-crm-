'use client'

import { useState, useEffect } from 'react'

const CLAUSES = [
  { title: '1. Objeto del Contrato', text: 'El prestador de servicios se obliga a proporcionar el servicio de transporte indicado en la presente carta, en las fechas, horarios y lugares especificados, con los medios de transporte y conductores idóneos para tal efecto.' },
  { title: '2. Precio y Forma de Pago', text: 'El precio total del servicio es el indicado en la presente carta. El pago deberá realizarse según las condiciones acordadas entre las partes. En caso de no mediar acuerdo expreso, el pago será al contado al momento de la prestación del servicio.' },
  { title: '3. Modificaciones y Cancelaciones', text: 'Cualquier modificación o cancelación del servicio deberá ser comunicada con al menos 48 horas de anticipación. Cancelaciones con menos de 24 horas de anticipación podrán estar sujetas a cobros por gastos incurridos.' },
  { title: '4. Responsabilidad del Prestador', text: 'El prestador se obliga a ejecutar el servicio con la debida diligencia y cuidado, garantizando la seguridad de los pasajeros durante el trayecto. El prestador cuenta con los seguros legalmente exigidos para la operación de vehículos de transporte de pasajeros.' },
  { title: '5. Responsabilidad del Contratante', text: 'El contratante se compromete a tener a los pasajeros listos en el punto de encuentro acordado en el horario establecido. El contratante es responsable del comportamiento de los pasajeros durante el servicio.' },
  { title: '6. Equipaje y Pertenencias', text: 'El prestador no se hace responsable por pérdida, daño o extravío de objetos personales, equipaje u otras pertenencias dejadas en los vehículos. Se recomienda a los pasajeros no dejar objetos de valor.' },
  { title: '7. Puntualidad', text: 'El prestador se compromete a cumplir con los horarios acordados. Retrasos superiores a 30 minutos no imputables al contratante o a causas de fuerza mayor darán derecho a una compensación a convenir entre las partes.' },
  { title: '8. Fuerza Mayor', text: 'Ninguna de las partes será responsable por incumplimientos debidos a causas de fuerza mayor o caso fortuito, incluyendo pero no limitándose a condiciones climáticas adversas, accidentes de tránsito, restricciones gubernamentales o eventos imprevisibles.' },
  { title: '9. Conductor y Vehículo', text: 'El prestador garantiza que el conductor asignado contará con la licencia de conducir vigente y habilitación correspondiente. El vehículo estará en óptimas condiciones mecánicas y cumplirá con la normativa vigente para el transporte de pasajeros.' },
  { title: '10. Derecho a Retiro', text: 'El prestador se reserva el derecho de suspender el servicio si el comportamiento de los pasajeros pone en riesgo la seguridad del viaje, sin que ello genere obligación de devolución del monto pagado.' },
  { title: '11. Resolución de Disputas', text: 'Cualquier controversia derivada de la presente carta de aprobación será resuelta de mutuo acuerdo entre las partes. En caso de no llegarse a acuerdo, se someterán a la jurisdicción de los Tribunales Ordinarios de Justicia de la ciudad de Santiago, Chile.' },
  { title: '12. Confidencialidad', text: 'Las partes se comprometen a mantener la confidencialidad de la información comercial y personal intercambiada en el marco del presente servicio, salvo requerimiento de autoridad competente.' },
  { title: '13. Cesión', text: 'El contratante no podrá ceder o transferir sus derechos u obligaciones derivados de la presente carta de aprobación a terceros sin el consentimiento previo y por escrito del prestador.' },
  { title: '14. Integridad del Acuerdo', text: 'La presente carta de aprobación constituye el acuerdo completo entre las partes respecto al servicio indicado y deja sin efecto cualquier comunicación o acuerdo previo sobre el mismo objeto.' },
  { title: '15. Protección de Datos Personales (Ley 19.628)', text: 'Los datos personales recopilados en el presente documento serán tratados conforme a la Ley N° 19.628 sobre Protección de la Vida Privada. Serán utilizados exclusivamente para la prestación del servicio y comunicaciones relacionadas. El titular tiene derecho a solicitar su modificación, eliminación o bloqueo en cualquier momento.' },
  { title: '16. Validez de Firma Digital (Ley 19.799)', text: 'La firma electrónica simple aplicada en este documento tiene plena validez conforme a la Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación de dicha firma. La aceptación digital del presente documento tiene el mismo efecto jurídico que una firma manuscrita.' },
]

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

function formatFecha(fecha: string, hora?: string): string {
  if (!fecha) return ''
  // fecha: "2026-11-19", hora: "08:30:00"
  const [y, m, d] = fecha.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const str = dateObj.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1)
  if (!hora) return capitalized
  const horaFmt = hora.slice(0, 5)
  return `${capitalized} a las ${horaFmt} hrs.`
}

type Letter = Record<string, string | number | null>

interface Comprobante {
  id: string
  tipo: string
  filename: string
  content_type: string
  uploaded_at: string
  size_bytes: number
  amount?: number | null
}

const TIPO_LABELS: Record<string, string> = {
  abono1: '1er abono (50%)',
  abono2: '2do abono (50%)',
  total:  'Pago total (100%)',
}

const MEDIO_LABELS: Record<string, string> = {
  al_contado:        'Contado — 1 pago total (100%)',
  cincuenta_cincuenta: 'Contado — 50% + 50%',
  credito_7:         'Crédito 7 días',
  credito_15:        'Crédito 15 días',
  credito_30:        'Crédito 30 días',
  credito_60:        'Crédito 60 días',
}

// Qué tipos de comprobante corresponden según forma_pago
function getTiposComprobante(formaPago: string): ('abono1' | 'abono2' | 'total')[] {
  if (formaPago === 'al_contado') return ['total']
  if (formaPago === 'cincuenta_cincuenta') return ['abono1', 'abono2']
  return [] // crédito: sin comprobante
}

export default function SigningForm({ letter, readOnly }: { letter: Letter; readOnly?: boolean }) {
  const [signedName, setSignedName] = useState('')
  const [signedRut, setSignedRut] = useState('')
  const [billing, setBilling] = useState({ billing_name: '', billing_rut: '', billing_address: '', billing_glosa: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const formaPago = (letter.forma_pago as string) ?? 'cincuenta_cincuenta'
  const tiposComprobante = getTiposComprobante(formaPago)
  const showComprobantes = tiposComprobante.length > 0

  // Comprobantes
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const token = letter.token as string
  const letterTotal = Number(letter.total ?? 0)

  async function reloadComprobantes() {
    try {
      const r = await fetch(`/api/approval-letters/${token}/comprobantes`)
      const j = await r.json()
      setComprobantes(j.data ?? [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (showComprobantes) reloadComprobantes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showComprobantes])

  async function handleSign() {
    if (!signedName.trim() || !signedRut.trim()) {
      setError('Debes ingresar tu nombre y RUT para firmar.')
      return
    }
    if (!billing.billing_rut.trim()) {
      setError('Debes ingresar el RUT de facturación.')
      return
    }
    setLoading(true)
    setError('')

    const body: Record<string, string> = {
      signed_name: signedName.trim(),
      signed_rut: signedRut.trim(),
      ...billing,
    }

    const res = await fetch(`/api/approval-letters/${letter.token}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setLoading(false)
    if (res.ok) {
      setDone(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al firmar')
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>¡Documento firmado exitosamente!</h2>
          <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 15 }}>Has aprobado el servicio de transporte.</p>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 13 }}>Se ha registrado tu firma con validez legal según la Ley 19.799.</p>
        </div>
        {showComprobantes && (
          <ComprobanteUploadSection
            comprobantes={comprobantes}
            tiposDisponibles={tiposComprobante}
            total={letterTotal}
            token={token}
            onUploaded={reloadComprobantes}
          />
        )}
      </div>
    )
  }

  const clientLabel = (letter.client_rut as string)?.length > 5 ? 'EMPRESA / CLIENTE' : 'CLIENTE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Intro */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, color: '#1c3050', lineHeight: 1.7 }}>
          Estimado/a <strong>{letter.client_name as string || 'cliente'}</strong>, a continuación encontrará los detalles
          del servicio de transporte cotizado. Por favor revise la información, lea los términos y condiciones,
          e ingrese sus datos para firmar y aprobar el servicio.
        </p>
      </div>

      {/* Datos del servicio */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#082e62', margin: '0 0 18px', borderBottom: '2px solid #e52832', paddingBottom: 10 }}>
          Detalle del Servicio
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 24px' }}>
          <Row label={clientLabel} value={letter.client_name as string} />
          {letter.client_rut && <Row label="RUT" value={letter.client_rut as string} />}
          {letter.desde && <Row label="Origen" value={letter.desde as string} />}
          {letter.hasta && <Row label="Destino" value={letter.hasta as string} />}
          {letter.fecha_salida && (
            <Row label="Fecha de salida" value={formatFecha(letter.fecha_salida as string, letter.hora_salida as string)} wide />
          )}
          {letter.fecha_retorno && (
            <Row label="Fecha de retorno" value={formatFecha(letter.fecha_retorno as string, letter.hora_retorno as string)} wide />
          )}
          {letter.seller_name && <Row label="Ejecutivo/a a cargo" value={letter.seller_name as string} />}
          {formaPago && MEDIO_LABELS[formaPago] && <Row label="Medio de pago acordado" value={MEDIO_LABELS[formaPago]} wide />}
        </div>
        {letter.total && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Valor total del servicio</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>{formatCLP(Number(letter.total))}</span>
          </div>
        )}
      </div>

      {/* Términos — SIN maxHeight, expansión natural para que el cliente pueda leer todo */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#082e62', margin: '0 0 16px', borderBottom: '2px solid #e52832', paddingBottom: 10 }}>
          Términos y Condiciones
        </h2>
        <div>
          {CLAUSES.map(c => (
            <div key={c.title} style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1c3050' }}>{c.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#52637c', lineHeight: 1.65 }}>{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Facturación */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#082e62', margin: '0 0 6px', borderBottom: '2px solid #e52832', paddingBottom: 10 }}>
          Datos de Facturación
        </h2>
        {readOnly ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 24px', marginTop: 16 }}>
            {letter.billing_name && <Row label="Razón social" value={letter.billing_name as string} />}
            {letter.billing_rut  && <Row label="RUT facturación" value={letter.billing_rut as string} />}
            {letter.billing_address && <Row label="Dirección" value={letter.billing_address as string} />}
            {letter.billing_glosa && <Row label="Glosa" value={letter.billing_glosa as string} wide />}
          </div>
        ) : (
          <>
            <p style={{ margin: '12px 0 16px', fontSize: 13, color: '#6b7280' }}>
              Ingrese los datos para emitir la factura del servicio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Razón social / Nombre *" value={billing.billing_name} onChange={v => setBilling(b => ({ ...b, billing_name: v }))} placeholder={letter.client_name as string} />
              <Field label="RUT de facturación *" value={billing.billing_rut} onChange={v => setBilling(b => ({ ...b, billing_rut: v }))} placeholder={(letter.client_rut as string) ?? '12.345.678-9'} />
              <Field label="Dirección" value={billing.billing_address} onChange={v => setBilling(b => ({ ...b, billing_address: v }))} />
              <Field label="Glosa / detalle factura" value={billing.billing_glosa} onChange={v => setBilling(b => ({ ...b, billing_glosa: v }))} />
            </div>
          </>
        )}
      </div>

      {/* Comprobantes — siempre visible si aplica (antes y después de firmar) */}
      {showComprobantes && (
        <ComprobanteUploadSection
          comprobantes={comprobantes}
          tiposDisponibles={tiposComprobante}
          total={letterTotal}
          token={token}
          onUploaded={reloadComprobantes}
        />
      )}

      {/* Firma — solo si no es readOnly */}
      {!readOnly && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#082e62', margin: '0 0 6px', borderBottom: '2px solid #e52832', paddingBottom: 10 }}>
            Firma Digital
          </h2>
          <p style={{ margin: '12px 0 16px', fontSize: 13, color: '#6b7280' }}>
            Al firmar, declara haber leído y aceptado todos los términos y condiciones. Válido según Ley 19.799.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Nombre completo del representante *" value={signedName} onChange={setSignedName} />
            <Field label="RUT del representante *" value={signedRut} onChange={setSignedRut} placeholder="12.345.678-9" />
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <p style={{ margin: 0, color: '#991b1b', fontSize: 13 }}>{error}</p>
            </div>
          )}
          <button
            onClick={handleSign}
            disabled={loading}
            style={{
              marginTop: 20, width: '100%', padding: '16px 24px', borderRadius: 10,
              background: loading ? '#9ca3af' : '#082e62', color: 'white', border: 'none',
              fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Firmando...' : 'Firmar y aceptar servicio'}
          </button>
          <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            Firma electrónica simple con validez legal — Ley N° 19.799
          </p>
        </div>
      )}
    </div>
  )
}

interface UploadSectionProps {
  comprobantes: Comprobante[]
  tiposDisponibles: ('abono1' | 'abono2' | 'total')[]
  total: number
  token: string
  onUploaded: () => void
}

function AbonoCard({ tipo, existing, total, token, onUploaded }: {
  tipo: 'abono1' | 'abono2' | 'total'
  existing: Comprobante | undefined
  total: number
  token: string
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [monto, setMonto] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const label = TIPO_LABELS[tipo] ?? tipo

  async function submit() {
    if (!file || !monto) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('file', file)
      fd.append('monto', monto.replace(/\D/g, ''))
      const r = await fetch(`/api/approval-letters/${token}/comprobantes`, { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Error al subir'); return }
      setFile(null)
      setMonto('')
      onUploaded()
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  // Si ya está subido mostramos el recibo, pero igual dejamos subir otro reemplazo
  return (
    <div style={{ border: existing ? '2px solid #86efac' : '2px dashed #bfdbfe', borderRadius: 12, padding: 16, background: existing ? '#f0fdf4' : '#f8faff' }}>
      <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#082e62' }}>{label}</p>

      {existing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#dcfce7', borderRadius: 8, border: '1px solid #86efac' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#166534' }}>
              {existing.amount ? formatCLP(existing.amount) : 'Recibido'}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {existing.filename} · {new Date(existing.uploaded_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      )}

      {/* Subida */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px',
          border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', background: file ? '#f0fdf4' : 'white' }}>
          {file
            ? <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#166534' }}>✅ {file.name}</p>
            : <>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" d="M12 16V8m0 0-3 3m3-3 3 3"/><path stroke="#9ca3af" strokeWidth="1.5" d="M20 16.7A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{existing ? 'Subir nuevo comprobante' : 'Seleccionar foto o PDF'}</p>
              </>
          }
          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Monto $</label>
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '')
              setMonto(digits ? '$' + Number(digits).toLocaleString('es-CL') : '')
            }}
            placeholder={total > 0 ? `Ej: ${formatCLP(total / 2)}` : 'Ej: $350.000'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: 15, color: '#111827', outline: 'none' }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: 12, color: '#991b1b' }}>{error}</p>}

        <button onClick={submit} disabled={uploading || !file || !monto}
          style={{ padding: '11px 16px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700,
            background: uploading || !file || !monto ? '#d1d5db' : '#082e62', color: 'white',
            cursor: uploading || !file || !monto ? 'not-allowed' : 'pointer' }}>
          {uploading ? 'Enviando...' : existing ? 'Reemplazar comprobante' : 'Enviar comprobante'}
        </button>
      </div>
    </div>
  )
}

function ComprobanteUploadSection({ comprobantes, tiposDisponibles, total, token, onUploaded }: UploadSectionProps) {
  const totalPaid = comprobantes.reduce((s, c) => s + (c.amount ?? 0), 0)
  const isFullyPaid = total > 0 && totalPaid >= total
  const pending = total - totalPaid

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '2px solid #bfdbfe', padding: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#082e62', margin: '0 0 6px', borderBottom: '2px solid #e52832', paddingBottom: 10 }}>
        Comprobantes de Pago
      </h2>
      <p style={{ margin: '12px 0 16px', fontSize: 13, color: '#6b7280' }}>
        Sube el comprobante de transferencia o depósito para cada abono. El sistema sumará ambos montos y verificará que coincidan con el total de la carta.
      </p>

      {/* Una tarjeta por cada tipo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tiposDisponibles.map(tipo => (
          <AbonoCard
            key={tipo}
            tipo={tipo}
            existing={comprobantes.find(c => c.tipo === tipo)}
            total={total}
            token={token}
            onUploaded={onUploaded}
          />
        ))}
      </div>

      {/* Resumen total */}
      {totalPaid > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: isFullyPaid ? '#dcfce7' : '#fefce8', border: `1px solid ${isFullyPaid ? '#86efac' : '#fde68a'}` }}>
          {isFullyPaid
            ? <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#166534' }}>✅ PAGADO AL 100% — {formatCLP(totalPaid)}</p>
            : <>
                <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>Total recibido: <strong>{formatCLP(totalPaid)}</strong></p>
                <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#b45309' }}>Pendiente por pagar: {formatCLP(pending)}</p>
              </>
          }
        </div>
      )}
    </div>
  )
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  if (!value) return null
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : {}}>
      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 600, color: '#1c3050', lineHeight: 1.4 }}>{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 8,
          border: '1px solid #d1d5db', fontSize: 16, color: '#111827', outline: 'none',
          fontFamily: 'inherit', background: 'white',
        }}
      />
    </div>
  )
}
