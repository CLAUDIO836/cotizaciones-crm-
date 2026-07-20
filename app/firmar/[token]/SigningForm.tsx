'use client'

import { useState } from 'react'

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

type Letter = Record<string, string | number | null>

export default function SigningForm({ letter }: { letter: Letter }) {
  const [wantsBilling, setWantsBilling] = useState(false)
  const [signedName, setSignedName] = useState('')
  const [signedRut, setSignedRut] = useState('')
  const [billing, setBilling] = useState({ billing_name: '', billing_rut: '', billing_address: '', billing_glosa: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSign() {
    if (!signedName.trim() || !signedRut.trim()) {
      setError('Debes ingresar tu nombre y RUT para firmar.')
      return
    }
    setLoading(true)
    setError('')

    const body: Record<string, string> = { signed_name: signedName.trim(), signed_rut: signedRut.trim() }
    if (wantsBilling && billing.billing_name) {
      Object.assign(body, billing)
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
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>¡Documento firmado exitosamente!</h2>
        <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: 15 }}>Has aprobado el servicio de transporte.</p>
        <p style={{ color: '#6b7280', margin: 0, fontSize: 13 }}>Se ha registrado tu firma con validez legal según la Ley 19.799.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Datos del servicio */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Detalle del Servicio</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          <Row label="Empresa" value={letter.client_name as string} />
          {letter.client_rut && <Row label="RUT" value={letter.client_rut as string} />}
          {letter.desde && <Row label="Origen" value={letter.desde as string} />}
          {letter.hasta && <Row label="Destino" value={letter.hasta as string} />}
          {letter.fecha_salida && (
            <Row label="Fecha salida" value={`${letter.fecha_salida}${letter.hora_salida ? ` a las ${letter.hora_salida}` : ''}`} />
          )}
          {letter.fecha_retorno && (
            <Row label="Fecha retorno" value={`${letter.fecha_retorno}${letter.hora_retorno ? ` a las ${letter.hora_retorno}` : ''}`} />
          )}
          {letter.seller_name && <Row label="Ejecutivo" value={letter.seller_name as string} />}
        </div>
        {letter.total && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Valor total del servicio</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{formatCLP(Number(letter.total))}</span>
          </div>
        )}
      </div>

      {/* Términos */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Términos y Condiciones</h2>
        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
          {CLAUSES.map(c => (
            <div key={c.title} style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: '#374151' }}>{c.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Facturación */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
          onClick={() => setWantsBilling(v => !v)}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 5, border: `2px solid ${wantsBilling ? '#1B8A4B' : '#d1d5db'}`,
            background: wantsBilling ? '#1B8A4B' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1
          }}>
            {wantsBilling && <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>Requiero factura a nombre de otra empresa</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Si no selecciona esta opción, la factura será emitida a nombre de <strong>{letter.client_name}</strong>{letter.client_rut ? ` RUT ${letter.client_rut}` : ''}.</p>
          </div>
        </div>

        {wantsBilling && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Razón social *" value={billing.billing_name} onChange={v => setBilling(b => ({ ...b, billing_name: v }))} />
            <Field label="RUT empresa *" value={billing.billing_rut} onChange={v => setBilling(b => ({ ...b, billing_rut: v }))} />
            <Field label="Dirección" value={billing.billing_address} onChange={v => setBilling(b => ({ ...b, billing_address: v }))} />
            <Field label="Glosa / detalle factura" value={billing.billing_glosa} onChange={v => setBilling(b => ({ ...b, billing_glosa: v }))} />
          </div>
        )}
      </div>

      {/* Firma */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Firma Digital</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
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
            marginTop: 16, width: '100%', padding: '14px 24px', borderRadius: 10,
            background: loading ? '#9ca3af' : '#1B8A4B', color: 'white', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Firmando...' : 'Firmar y aceptar servicio'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
          border: '1px solid #d1d5db', fontSize: 14, color: '#111827', outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}
