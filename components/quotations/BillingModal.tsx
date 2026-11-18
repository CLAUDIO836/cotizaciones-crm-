'use client'

import { useState } from 'react'
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  quotationId: string
  billingName: string
  billingRut:  string
  billingAddr: string
  onSuccess:   () => void
  onClose:     () => void
  // Si ya está ganado solo se suben comprobantes / editan datos de facturación
  alreadyWon?: boolean
}

const FORMAS_PAGO = [
  { key: 'al_contado',          label: 'Al contado',                        desc: 'Pago total antes del servicio', color: '#1B8A4B', isCredit: false },
  { key: 'cincuenta_cincuenta', label: '50% + 50%',                         desc: '50% abono ahora, 50% antes del servicio', color: '#0ea5e9', isCredit: false },
  { key: 'credito_7',           label: 'Crédito 7 días',                    desc: 'Requiere autorización de gerencia', color: '#f97316', isCredit: true },
  { key: 'credito_15',          label: 'Crédito 15 días',                   desc: 'Requiere autorización de gerencia', color: '#f97316', isCredit: true },
  { key: 'credito_30',          label: 'Crédito 30 días',                   desc: 'Requiere autorización de gerencia', color: '#f97316', isCredit: true },
]

export default function BillingModal({ quotationId, billingName, billingRut, billingAddr, onSuccess, onClose, alreadyWon = false }: Props) {
  const [formaPago,   setFormaPago]   = useState('')
  const [name,        setName]        = useState(billingName)
  const [rut,         setRut]         = useState(billingRut)
  const [addr,        setAddr]        = useState(billingAddr)
  const [giro,        setGiro]        = useState('')
  const [notas,       setNotas]       = useState('')
  const [files,       setFiles]       = useState<File[]>([])
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState('')

  const selected = FORMAS_PAGO.find(f => f.key === formaPago)
  const needComprobante = formaPago === 'al_contado' || formaPago === 'cincuenta_cincuenta'

  async function handleSubmit() {
    if (!formaPago)    { setError('Selecciona una forma de pago'); return }
    if (!name.trim())  { setError('Ingresa la razón social'); return }
    if (!rut.trim())   { setError('Ingresa el RUT'); return }
    setSending(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('forma_pago',      formaPago)
      fd.append('billing_name',    name.trim())
      fd.append('billing_rut',     rut.trim())
      fd.append('billing_address', addr.trim())
      fd.append('billing_giro',    giro.trim())
      fd.append('notas',           notas.trim())
      for (const f of files) fd.append('comprobantes', f)

      const res = await fetch(`/api/quotations/${quotationId}/billing-won`, { method: 'POST', body: fd })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error al procesar')
      onSuccess()
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="font-bold text-gray-900">
              {alreadyWon ? 'Datos de facturación y comprobantes' : 'Confirmar negocio ganado'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Forma de pago */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Forma de pago *</p>
            <div className="grid grid-cols-1 gap-2">
              {FORMAS_PAGO.map(fp => (
                <button key={fp.key} type="button" onClick={() => setFormaPago(fp.key)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                  style={formaPago === fp.key
                    ? { borderColor: fp.color, background: `${fp.color}10` }
                    : { borderColor: '#e5e7eb', background: 'white' }}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: formaPago === fp.key ? fp.color : '#d1d5db' }}>
                    {formaPago === fp.key && <div className="w-2 h-2 rounded-full" style={{ background: fp.color }} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fp.label}</p>
                    <p className="text-xs text-gray-500">{fp.desc}</p>
                  </div>
                  {fp.isCredit && (
                    <AlertTriangle className="w-4 h-4 text-orange-400 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {selected?.isCredit && (
              <div className="mt-2 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">Esta forma de pago requiere autorización de Claudio o Claudia antes de facturar.</p>
              </div>
            )}
          </div>

          {/* Datos de facturación */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Datos de facturación *</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Razón social *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre empresa o persona"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">RUT *</label>
                  <input value={rut} onChange={e => setRut(e.target.value)} placeholder="12.345.678-9"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Giro</label>
                  <input value={giro} onChange={e => setGiro(e.target.value)} placeholder="Giro comercial"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Dirección</label>
                <input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Dirección de facturación"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
              </div>
            </div>
          </div>

          {/* Comprobantes (si no es crédito, o si ya está ganado siempre se muestra) */}
          {(needComprobante || alreadyWon) && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Comprobantes de pago</p>
              <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-green-300 hover:bg-green-50 transition-colors">
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-500">Haz clic para adjuntar comprobantes</span>
                <span className="text-xs text-gray-400">PDF, imagen (máx. 10MB por archivo)</span>
                <input type="file" multiple accept="image/*,application/pdf" className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files ?? []))} />
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5 border">
                      <span className="text-gray-700 truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Instrucciones especiales para contabilidad..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5 sticky bottom-0 bg-white pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button onClick={handleSubmit} disabled={sending}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 flex items-center gap-2"
            style={{ background: '#1B8A4B' }}>
            <CheckCircle className="w-4 h-4" />
            {sending ? 'Procesando...' : alreadyWon ? 'Enviar a contabilidad' : 'Confirmar ganado y enviar a contabilidad'}
          </button>
        </div>
      </div>
    </div>
  )
}
