'use client'
import { useState, useEffect, useRef } from 'react'

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended' | 'error'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('56') && digits.length >= 10) return `+${digits}`
  if (digits.length === 8 || digits.length === 9) return `+56${digits}`
  if (digits.length >= 10) return `+${digits}`
  return raw
}

const KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['*','0','#'],
]

export default function FloatingSoftphone() {
  const [open, setOpen]         = useState(false)
  const [number, setNumber]     = useState('')
  const [state, setState]       = useState<CallState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const deviceRef  = useRef<import('@twilio/voice-sdk').Device | null>(null)
  const callRef    = useRef<import('@twilio/voice-sdk').Call | null>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const durRef     = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      deviceRef.current?.destroy()
    }
  }, [])

  function pressKey(k: string) {
    if (state !== 'idle') return
    setNumber(n => n + k)
    callRef.current?.sendDigits(k)
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function llamar() {
    if (!number.trim()) return
    setState('connecting')
    setError(null)
    setDuration(0)
    durRef.current = 0
    try {
      const res = await fetch('/api/twilio/token', { method: 'POST' })
      if (!res.ok) throw new Error('Sin autorización')
      const { token } = await res.json()
      const { Device } = await import('@twilio/voice-sdk')
      const device = new Device(token, { logLevel: 0 })
      deviceRef.current = device
      await device.register()
      const call = await device.connect({ params: { To: normalizePhone(number) } })
      callRef.current = call
      setState('ringing')
      call.on('accept', () => {
        setState('in-call')
        timerRef.current = setInterval(() => {
          durRef.current += 1
          setDuration(d => d + 1)
        }, 1000)
      })
      call.on('disconnect', () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setState('ended')
        setTimeout(() => { setState('idle'); setNumber('') }, 3000)
      })
      call.on('error', (err: Error) => {
        setError(err.message)
        setState('error')
        setTimeout(() => setState('idle'), 4000)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  function colgar() { callRef.current?.disconnect() }

  const inCall = state === 'in-call' || state === 'ringing'
  const busy   = state !== 'idle'

  return (
    <div className="fixed bottom-20 right-5 z-40 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-64 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between"
               style={{ background: '#1B8A4B' }}>
            <span className="text-white text-sm font-semibold">Teléfono CRM</span>
            {inCall && (
              <span className="text-xs text-green-200 font-mono">{fmt(duration)}</span>
            )}
          </div>

          {/* Display */}
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <input
                type="tel"
                value={number}
                onChange={e => !busy && setNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && state === 'idle' && llamar()}
                placeholder="+56 9 1234 5678"
                className="w-full text-center text-lg font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                readOnly={busy}
              />
              {number && !busy && (
                <button onClick={() => setNumber(n => n.slice(0, -1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg">
                  ⌫
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-500 text-center mt-1">{error}</p>}
            {state === 'ended' && <p className="text-xs text-green-600 text-center mt-1">✅ Llamada finalizada</p>}
          </div>

          {/* Keypad */}
          <div className="px-4 py-2 grid grid-cols-3 gap-1.5">
            {KEYS.map(row => row.map(k => (
              <button key={k} onClick={() => pressKey(k)}
                className="h-10 rounded-lg text-gray-700 font-semibold text-base hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all">
                {k}
              </button>
            )))}
          </div>

          {/* Call button */}
          <div className="px-4 pb-4 pt-1">
            {!inCall ? (
              <button onClick={llamar}
                disabled={!number.trim() || busy}
                className="w-full py-2.5 rounded-xl text-white font-bold text-base transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#1B8A4B' }}>
                {state === 'connecting' ? (
                  <><span className="animate-spin text-sm">⟳</span> Conectando...</>
                ) : '📞 Llamar'}
              </button>
            ) : (
              <button onClick={colgar}
                className="w-full py-2.5 rounded-xl text-white font-bold text-base bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2">
                📵 {state === 'ringing' ? 'Cancelar' : 'Colgar'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all hover:scale-105 active:scale-95"
        style={{ background: inCall ? '#ef4444' : '#1B8A4B' }}
        title="Teléfono">
        {inCall ? '📵' : '📞'}
      </button>
    </div>
  )
}
