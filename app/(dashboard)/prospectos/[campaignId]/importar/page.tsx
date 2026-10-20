export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/api'
import { fetchCampaigns } from '@/lib/prospectos-api'
import { redirect, notFound } from 'next/navigation'
import ImportarCSV from '@/components/prospectos/ImportarCSV'
import Link from 'next/link'

export default async function ImportarPage({
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

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="px-6 pt-5 mb-2">
          <Link href={`/prospectos/${campaignId}`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Cola de llamados
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 m-4">
          <ImportarCSV campaignId={campaignId} campaignName={campaign.name} />
        </div>
      </div>
    </div>
  )
}
