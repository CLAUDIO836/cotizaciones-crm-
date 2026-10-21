import 'server-only'

const BASE = process.env.EVOLUTION_API_URL!
const KEY  = process.env.EVOLUTION_API_KEY!

function headers() {
  return { 'Content-Type': 'application/json', apikey: KEY }
}

export async function evoFetch(path: string, opts: RequestInit = {}, timeoutMs = 20000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { ...headers(), ...(opts.headers ?? {}) },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Evolution API ${path} → ${res.status}: ${text}`)
    }
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// ── Instances ─────────────────────────────────────────────────────────────────

export function instanceName(userId: string) {
  return `transccl_${userId}`
}

export async function createInstance(userId: string, userName: string) {
  return evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: instanceName(userId),
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhookUrl: `${process.env.APP_URL}/api/whatsapp/webhook`,
      webhookByEvents: true,
      webhookEvents: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      webhookBase64: false,
      chatwootAccountId: null,
    }),
  })
}

export async function getInstanceStatus(userId: string) {
  try {
    const data = await evoFetch(`/instance/connectionState/${instanceName(userId)}`)
    return data.instance?.state ?? 'unknown'
  } catch {
    return 'not_created'
  }
}

export async function getQRCode(userId: string) {
  return evoFetch(`/instance/connect/${instanceName(userId)}`)
}

export async function deleteInstance(userId: string) {
  return evoFetch(`/instance/delete/${instanceName(userId)}`, { method: 'DELETE' })
}

export async function getAllInstances() {
  try {
    return await evoFetch('/instance/fetchInstances')
  } catch {
    return []
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('56')) return digits
  if (digits.startsWith('9') && digits.length === 9) return `56${digits}`
  if (digits.length === 8) return `569${digits}`
  return digits
}

export async function sendTextMessage(userId: string, toPhone: string, text: string) {
  const number = normalizePhone(toPhone)
  return evoFetch(`/message/sendText/${instanceName(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  })
}

export async function fetchMessages(userId: string, toPhone: string, count = 40) {
  const number = normalizePhone(toPhone)
  try {
    return await evoFetch(`/chat/findMessages/${instanceName(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ where: { key: { remoteJid: `${number}@s.whatsapp.net` } }, limit: count }),
    })
  } catch {
    return { messages: { records: [] } }
  }
}
