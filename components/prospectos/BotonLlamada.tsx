'use client'
import { useState, useEffect, useRef } from 'react'

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended' | 'error'

interface Props {
  phoneNumber: string
  contactName: string
  prospectId: string
  contactId?: string
  onCallLogged?: (callSid: string, duration: number) => void
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('56') && digits.length >= 10) return `+${digits}`
  if (digits.length === 8 || digits.length === 9) return `+56${digits}`
  if (digits.length >= 10) return `+${digits}`
  return raw
}

export default function BotonLlamada({ phoneNumber, contactName, prospectId, contactId, onCallLogged }: Props) {
  const phone = normalizePhone(phoneNumber)
  const [state, setState]     = useState<CallState>('idle')
  const [duration, setDuration] = useState(0)
  const [callSid, setCallSid]  = useState<string | null>(null)
  const [error, setError]      = useState<string | null>(null)
  const deviceRef   = useRef<import('@twilio/voice-sdk').Device | null>(null)
  const callRef     = useRef<import('@twilio/voice-sdk').Call | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      deviceRef.current?.destroy()
    }
  }, [])

  async function iniciarLlamada() {
    setState('connecting')
    setError(null)
    setDuration(0)

    try {
      // 1. Obtener token del server
      const tokenRes = await fetch('/api/twilio/token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Sin autorización')
      const { token } = await tokenRes.json()

      // 2. Inicializar Device
      const { Device } = await import('@twilio/voice-sdk')
      const device = new Device(token, { logLevel: 0 })
      deviceRef.current = device

      await device.register()

      // 3. Iniciar llamada
      const call = await device.connect({
        params: { To: phone, prospect_id: prospectId, contact_id: contactId ?? '' },
      })
      callRef.current = call
      setState('ringing')

      call.on('accept', (c) => {
        const sid = c.parameters.CallSid ?? null
        setCallSid(sid)
        setState('in-call')
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        // Registrar llamada para routing de llamadas entrantes
        if (sid) {
          fetch('/api/prospectos/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prospect_id: prospectId,
              contact_id: contactId ?? null,
              type: 'call',
              call_sid: sid,
            }),
          }).catch(() => {})
        }
      })

      call.on('disconnect', () => {
        if (timerRef.current) clearInterval(timerRef.current)
        const dur = duration
        setState('ended')
        if (callSid) onCallLogged?.(callSid, dur)
        setTimeout(() => setState('idle'), 4000)
      })

      call.on('error', (err: Error) => {
        setError(err.message)
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  function colgar() {
    callRef.current?.disconnect()
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  if (state === 'idle') {
    return (
      <button onClick={iniciarLlamada}
        className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-sm hover:bg-green-50 hover:border-green-400 transition-all"
        title={`Llamar a ${contactName}`}>
        📞
      </button>
    )
  }

  if (state === 'connecting') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 bg-gray-50">
        <span className="animate-spin">⟳</span> Conectando...
      </span>
    )
  }

  if (state === 'ringing') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 px-2 py-1 rounded border border-blue-200 bg-blue-50">
        📞 Llamando a {contactName}...
        <button onClick={colgar} className="ml-1 text-red-500 hover:text-red-700">✕</button>
      </span>
    )
  }

  if (state === 'in-call') {
    return (
      <span className="flex items-center gap-2 text-xs px-2 py-1 rounded border border-green-300 bg-green-50">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-mono text-green-700">{formatTime(duration)}</span>
        <button onClick={colgar}
          className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
          Colgar
        </button>
      </span>
    )
  }

  if (state === 'ended') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 px-2 py-1 rounded border border-green-200 bg-green-50">
        ✅ Llamada registrada ({formatTime(duration)})
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-red-600 px-2 py-1 rounded border border-red-200 bg-red-50" title={error ?? ''}>
      ⚠ Error en llamada
    </span>
  )
}
