export const dynamic = 'force-dynamic'
import { getSession, getToken } from '@/lib/api'
import { redirect } from 'next/navigation'
import StgConvDetail from '@/components/stg/StgConvDetail'

const CRM_API = (process.env.CRM_API_URL ?? 'https://www.transccl.cl/crm-api.php').replace('://transccl.cl', '://www.transccl.cl')

export default async function StgConvPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { id } = await params
  const token = await getToken()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null
  let error: string | null = null

  try {
    const res = await fetch(`${CRM_API}?action=stg_conv_detail&id=${encodeURIComponent(id)}&token=${encodeURIComponent(token ?? '')}`, {
      cache: 'no-store',
    })
    const json = await res.json()
    if (!res.ok) {
      error = json.error ?? `Error ${res.status}`
    } else {
      data = json.data
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error de conexión'
  }

  return <StgConvDetail user={user} data={data} error={error} convId={id} />
}
