export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { fetchCampaigns } from '@/lib/prospectos-api'
import { redirect, notFound } from 'next/navigation'
import PlanSemanal from '@/components/prospectos/PlanSemanal'

export default async function PlanSemanalPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  const { campaignId } = await params
  const campaigns = await fetchCampaigns()
  const campaign = campaigns.find(c => c.id === campaignId)
  if (!campaign) notFound()

  return <PlanSemanal campaignId={campaignId} campaignName={campaign.name} />
}
