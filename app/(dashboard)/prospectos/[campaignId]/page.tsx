export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { fetchProspects, fetchCampaigns, fetchCampaignCommunes } from '@/lib/prospectos-api'
import { redirect, notFound } from 'next/navigation'
import ProspectosCola from '@/components/prospectos/ProspectosCola'

export default async function CampaignQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>
  searchParams: Promise<{ status?: string; commune?: string; q?: string; call_cat?: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { campaignId } = await params
  const sp = await searchParams

  const [campaigns, prospects, communes] = await Promise.all([
    fetchCampaigns(),
    fetchProspects({
      campaign_id: campaignId,
      status:   sp.status,
      commune:  sp.commune,
      q:        sp.q,
      call_cat: sp.call_cat,
    }),
    fetchCampaignCommunes(campaignId),
  ])

  const campaign = campaigns.find(c => c.id === campaignId)
  if (!campaign) notFound()

  return (
    <ProspectosCola
      campaign={campaign}
      prospects={prospects}
      communes={communes}
      user={user}
      filters={{ status: sp.status, commune: sp.commune, q: sp.q, call_cat: sp.call_cat }}
    />
  )
}
