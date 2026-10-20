export const dynamic = 'force-dynamic'
import { getSession, fetchProfiles } from '@/lib/api'
import { fetchProspect, fetchCampaigns } from '@/lib/prospectos-api'
import { redirect, notFound } from 'next/navigation'
import ProspectoFicha from '@/components/prospectos/ProspectoFicha'

export default async function ProspectoPage({
  params,
}: {
  params: Promise<{ campaignId: string; prospectId: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { campaignId, prospectId } = await params

  const [prospect, campaigns, profiles] = await Promise.all([
    fetchProspect(prospectId),
    fetchCampaigns(),
    fetchProfiles(),
  ])

  if (!prospect) notFound()
  const campaign = campaigns.find(c => c.id === campaignId)

  return (
    <ProspectoFicha
      prospect={prospect}
      campaign={campaign ?? null}
      profiles={profiles}
      user={user}
    />
  )
}
