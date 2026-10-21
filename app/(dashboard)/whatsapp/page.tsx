export const dynamic = 'force-dynamic'
import { getSession, fetchProfiles } from '@/lib/api'
import { redirect } from 'next/navigation'
import WhatsAppAdmin from '@/components/whatsapp/WhatsAppAdmin'

export default async function WhatsAppPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const profiles = await fetchProfiles()

  return <WhatsAppAdmin user={user} profiles={profiles} />
}
