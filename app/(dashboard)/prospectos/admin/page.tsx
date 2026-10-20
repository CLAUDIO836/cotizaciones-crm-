export const dynamic = 'force-dynamic'
import { getSession, fetchProfiles } from '@/lib/api'
import { fetchCampaigns, fetchCommuneAssignments, fetchCampaignCommunes } from '@/lib/prospectos-api'
import { redirect } from 'next/navigation'
import ComunasAdmin from '@/components/prospectos/ComunasAdmin'

export default async function AdminComunasPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign_id?: string }>
}) {
  const user = await getSession()
  if (!user || user.role !== 'admin') redirect('/prospectos')

  const sp = await searchParams
  const [campaigns, profiles] = await Promise.all([
    fetchCampaigns(),
    fetchProfiles(),
  ])

  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const selectedId = sp.campaign_id ?? activeCampaigns[0]?.id ?? null

  const [assignments, communes] = selectedId
    ? await Promise.all([
        fetchCommuneAssignments(selectedId),
        fetchCampaignCommunes(selectedId),
      ])
    : [[], []]

  return (
    <ComunasAdmin
      campaigns={activeCampaigns}
      selectedCampaignId={selectedId}
      assignments={assignments}
      communes={communes}
      profiles={profiles}
    />
  )
}
