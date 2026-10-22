export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { fetchCampaigns } from '@/lib/prospectos-api'
import { fetchProfiles } from '@/lib/api'
import { redirect, notFound } from 'next/navigation'
import ProspectosDashboard from '@/components/prospectos/ProspectosDashboard'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { campaignId } = await params
  const [campaigns, profiles] = await Promise.all([
    fetchCampaigns(),
    fetchProfiles(),
  ])

  const campaign = campaigns.find(c => c.id === campaignId)
  if (!campaign) notFound()

  const isAdmin = user.role === 'admin' || user.role === 'coordinador'
  const executives = profiles
    .filter(p => p.role !== 'coordinador')
    .map(p => ({ id: p.id, name: p.name ?? p.email }))

  return (
    <ProspectosDashboard
      campaign={campaign}
      user={user}
      isAdmin={isAdmin}
      executives={executives}
    />
  )
}
