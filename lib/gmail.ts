const GMAIL_TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const GMAIL_SEND_URL    = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const GMAIL_THREAD_URL  = 'https://gmail.googleapis.com/gmail/v1/users/me/threads'

async function getAccessToken(refreshToken: string): Promise<string> {
  const r = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`Gmail token error: ${j.error ?? JSON.stringify(j)}`)
  return j.access_token
}

export interface MailAttachment {
  filename:    string
  contentType: string
  data:        Buffer   // raw bytes
}

function buildMime(opts: {
  from:         string
  to:           string
  cc?:          string
  subject:      string
  html:         string
  attachments?: MailAttachment[]
  threadId?:    string
  messageId?:   string
}): string {
  const outerBoundary = `outer_${Date.now()}`
  const hasAttachments = opts.attachments && opts.attachments.length > 0

  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${outerBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${outerBoundary}"`,
  ]
  if (opts.messageId) {
    lines.push(`In-Reply-To: ${opts.messageId}`)
    lines.push(`References: ${opts.messageId}`)
  }
  lines.push(
    '',
    `--${outerBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(opts.html).toString('base64'),
    '',
  )
  if (hasAttachments) {
    for (const att of opts.attachments!) {
      lines.push(
        `--${outerBoundary}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.data.toString('base64'),
        '',
      )
    }
  }
  lines.push(`--${outerBoundary}--`)
  const mime = lines.join('\r\n')
  return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(s: string): string {
  try { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8') } catch { return '' }
}

function extractHtml(payload: Record<string, unknown>): string {
  const mimeType = payload.mimeType as string | undefined
  const body = payload.body as { data?: string } | undefined
  if (body?.data && mimeType === 'text/html') return decodeBase64Url(body.data)
  if (body?.data && mimeType === 'text/plain') {
    const t = decodeBase64Url(body.data)
    return t.split('\n').map(l => `<p style="margin:0 0 8px">${l || '&nbsp;'}</p>`).join('')
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined
  if (!parts) return ''
  for (const p of parts) {
    const html = extractHtml(p)
    if (html) return html
  }
  return ''
}

export interface GmailMessage {
  messageId: string
  threadId:  string
  from:      string
  to:        string
  subject:   string
  date:      string
  bodyHtml:  string
}

export async function searchGmailMessages(refreshToken: string, query: string, maxResults = 50): Promise<GmailMessage[]> {
  const accessToken = await getAccessToken(refreshToken)
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!r.ok) return []
  const j = await r.json()
  const msgList: { id: string }[] = j.messages ?? []
  if (msgList.length === 0) return []
  const results: GmailMessage[] = []
  for (const { id } of msgList) {
    const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!mr.ok) continue
    const msg = await mr.json()
    const headers: Record<string, string> = {}
    for (const h of (msg.payload?.headers ?? [])) {
      headers[(h.name as string).toLowerCase()] = h.value as string
    }
    results.push({
      messageId: msg.id as string,
      threadId:  msg.threadId as string,
      from:      headers['from']    ?? '',
      to:        headers['to']      ?? '',
      subject:   headers['subject'] ?? '',
      date:      headers['date']    ?? '',
      bodyHtml:  extractHtml(msg.payload ?? {}),
    })
  }
  return results
}

export async function fetchGmailThread(refreshToken: string, threadId: string): Promise<GmailMessage[]> {
  const accessToken = await getAccessToken(refreshToken)
  const r = await fetch(`${GMAIL_THREAD_URL}/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) return []
  const j = await r.json()
  const messages: GmailMessage[] = []
  for (const msg of (j.messages ?? [])) {
    const headers: Record<string, string> = {}
    for (const h of (msg.payload?.headers ?? [])) {
      headers[(h.name as string).toLowerCase()] = h.value as string
    }
    messages.push({
      messageId: msg.id as string,
      threadId:  msg.threadId as string,
      from:      headers['from']    ?? '',
      to:        headers['to']      ?? '',
      subject:   headers['subject'] ?? '',
      date:      headers['date']    ?? '',
      bodyHtml:  extractHtml(msg.payload ?? {}),
    })
  }
  return messages
}

export async function sendViaGmail(opts: {
  refreshToken:  string
  from:          string
  to:            string
  cc?:           string
  subject:       string
  html:          string
  attachments?:  MailAttachment[]
  threadId?:     string
}): Promise<{ messageId: string; threadId: string }> {
  const accessToken = await getAccessToken(opts.refreshToken)
  const raw = buildMime({ from: opts.from, to: opts.to, cc: opts.cc, subject: opts.subject, html: opts.html, attachments: opts.attachments })

  const body: Record<string, string> = { raw }
  if (opts.threadId) body.threadId = opts.threadId

  const r = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Gmail send error ${r.status}: ${j.error?.message ?? JSON.stringify(j)}`)
  return { messageId: j.id, threadId: j.threadId ?? j.id }
}
