import SofiaDashboard from '@/components/agent/SofiaDashboard'
import { getSession } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function AgentePage() {
  const session = await getSession()
  const canSwitchEnv = session?.role === 'admin' || session?.role === 'superadmin'
  return <SofiaDashboard canSwitchEnv={canSwitchEnv} />
}
