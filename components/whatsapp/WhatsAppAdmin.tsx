'use client'
import { useState, useEffect, useCallback } from 'react'
import { UserSession } from '@/lib/api'
import Image from 'next/image'

type Profile = { id: string; name: string; email: string; role: string }
type ConnState = 'loading' | 'connected' | 'qr' | 'disconnected' | 'error'

function UserCard({ profile, isCurrentUser }: { profile: Profile; isCurrentUser: boolean }) {
  const [state, setState]   = useState<ConnState>('loading')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(`/api/whatsapp/status?userId=${profile.id}`, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) { setState('disconnected'); return }
      const d = await res.json()
      setState(d.state === 'open' ? 'connected' : 'disconnected')
    } catch {
      setState('disconnected')
    }
  }, [profile.id])

  useEffect(() => { checkStatus() }, [checkStatus])

  // Poll while QR is visible to detect scan
  useEffect(() => {
    if (state !== 'qr' || !polling) return
    const iv = setInterval(async () => {
      const res = await fetch(`/api/whatsapp/status?userId=${profile.id}`)
      const d   = await res.json()
      if (d.state === 'open') {
        setState('connected')
        setQrCode(null)
        setPolling(false)
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [state, polling, profile.id])

  async function connect() {
    setState('loading')
    const res = await fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id }),
    })
    const d = await res.json()
    if (d.status === 'connected') {
      setState('connected')
    } else if (d.qrcode) {
      setQrCode(d.qrcode)
      setState('qr')
      setPolling(true)
    } else {
      setState('error')
    }
  }

  async function disconnect() {
    if (!confirm(`¿Desconectar WhatsApp de ${profile.name}?`)) return
    await fetch('/api/whatsapp/disconnect', { method: 'POST' })
    setState('disconnected')
    setQrCode(null)
  }

  const stateLabel: Record<ConnState, { color: string; label: string }> = {
    loading:      { color: 'bg-gray-100 text-gray-500',   label: 'Verificando…' },
    connected:    { color: 'bg-green-100 text-green-700', label: 'Conectado' },
    qr:           { color: 'bg-yellow-100 text-yellow-700', label: 'Escanear QR' },
    disconnected: { color: 'bg-red-100 text-red-600',     label: 'Desconectado' },
    error:        { color: 'bg-red-100 text-red-600',     label: 'Error' },
  }
  const { color, label } = stateLabel[state]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{profile.name}
              {isCurrentUser && <span className="ml-2 text-xs text-gray-400">(tú)</span>}
            </p>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{label}</span>
      </div>

      {state === 'qr' && qrCode && (
        <div className="flex flex-col items-center gap-2 my-4">
          <p className="text-sm text-gray-600">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
          <div className="border-4 border-green-500 rounded-xl overflow-hidden">
            <Image src={`data:image/png;base64,${qrCode}`} alt="QR WhatsApp" width={220} height={220} />
          </div>
          <p className="text-xs text-gray-400">El QR expira en 60 segundos. Actualiza si es necesario.</p>
          <button onClick={connect} className="text-xs text-blue-600 hover:underline">Actualizar QR</button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        {state === 'disconnected' || state === 'error' ? (
          <button onClick={connect}
            className="flex-1 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
            Conectar WhatsApp
          </button>
        ) : state === 'connected' ? (
          <button onClick={disconnect}
            className="flex-1 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
            Desconectar
          </button>
        ) : null}
        {state === 'loading' && (
          <div className="flex-1 py-2 text-center text-sm text-gray-400">Verificando…</div>
        )}
      </div>
    </div>
  )
}

export default function WhatsAppAdmin({
  user, profiles,
}: {
  user: UserSession
  profiles: Profile[]
}) {
  const isAdmin = user.role === 'admin' || user.role === 'superadmin'

  const visibleProfiles = isAdmin
    ? profiles.filter(p => ['ejecutivo', 'vendedor', 'coordinador', 'admin', 'superadmin'].includes(p.role))
    : profiles.filter(p => p.id === user.id)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conecta tu WhatsApp personal para enviar mensajes desde el CRM.
          Cada ejecutivo escanea el QR una vez — la sesión se mantiene activa en el servidor.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Importante:</strong> al conectar aquí, WhatsApp Web en tu navegador se desconectará.
        Usa solo el CRM para enviar mensajes, o conecta un segundo celular.
      </div>

      <div className={`grid gap-4 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-sm'}`}>
        {visibleProfiles.map(p => (
          <UserCard key={p.id} profile={p} isCurrentUser={p.id === user.id} />
        ))}
      </div>
    </div>
  )
}
