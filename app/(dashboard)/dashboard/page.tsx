import { getSession, fetchQuotationsSummary, fetchProfiles } from '@/lib/api'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const user = await getSession()
  const now = new Date()
  // Fetch 3 years back to support the year granularity view
  const startDate = new Date(now.getFullYear() - 2, 0, 1).toISOString().split('T')[0]

  const [quotations, profiles] = await Promise.all([
    fetchQuotationsSummary({ start: startDate }),
    fetchProfiles(),
  ])

  const companies = [...new Set(quotations.map(q => q.company).filter(Boolean) as string[])].sort()

  return (
    <DashboardClient
      quotations={quotations}
      profiles={profiles ?? []}
      companies={companies}
    />
  )
}
