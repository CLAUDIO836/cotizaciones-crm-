export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { redirect } from 'next/navigation'
import Bandeja from '@/components/bandeja/Bandeja'

export default async function BandejaPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  return <Bandeja user={user} />
}
