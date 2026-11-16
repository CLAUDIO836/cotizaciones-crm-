const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_SEND_URL  = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

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

function buildMime(opts: {
  from:    string
  to:      string
  subject: string
  html:    string
}): string {
  const boundary = `boundary_${Date.now()}`
  const mime = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(opts.html).toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\r\n')
  return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendViaGmail(opts: {
  refreshToken: string
  from:         string
  to:           string
  subject:      string
  html:         string
}): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(opts.refreshToken)
  const raw = buildMime({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html })

  const r = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Gmail send error ${r.status}: ${j.error?.message ?? JSON.stringify(j)}`)
  return { messageId: j.id }
}
