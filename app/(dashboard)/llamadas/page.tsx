import { redirect } from 'next/navigation'
import { getSession, getToken } from '@/lib/api'
import LlamadasClient from './LlamadasClient'

const CRM_API = 'https://www.transccl.cl/crm-api.php'

export default async function LlamadasPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const token = await getToken()

  let calls: unknown[] = []
  let executives: { id: string; name: string }[] = []

  try {
    const [callsRes, usersRes] = await Promise.all([
      fetch(`${CRM_API}?action=outbound_calls_list&limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch(`${CRM_API}?action=profiles_list`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
    ])
    const callsJson = await callsRes.json()
    const usersJson = await usersRes.json()
    calls      = Array.isArray(callsJson.data) ? callsJson.data : []
    executives = Array.isArray(usersJson.data)
      ? usersJson.data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
      : []
  } catch { /* mostrado en cliente */ }

  return <LlamadasClient calls={calls as never} executives={executives} isAdmin={session.role === 'admin' || session.role === 'superadmin'} />
}
