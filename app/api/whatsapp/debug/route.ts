import 'server-only'
import { NextResponse } from 'next/server'
import { evoFetch, getInstanceStatus, instanceName } from '@/lib/evolution'

export async function GET() {
  const testUserId = 'debug'
  const iName = instanceName(testUserId)
  const results: Record<string, unknown> = {}

  // 1. Check if we can reach API
  try {
    results.ping = await evoFetch('/')
  } catch (e) {
    results.ping = { error: String(e) }
  }

  // 2. List all instances
  try {
    results.instances = await evoFetch('/instance/fetchInstances')
  } catch (e) {
    results.instances = { error: String(e) }
  }

  // 3. Try to get status of a real instance (first one if exists)
  const instances = Array.isArray(results.instances) ? results.instances : []
  if (instances.length > 0) {
    const first = instances[0]
    const name = first.instance?.instanceName ?? first.name
    if (name) {
      try {
        results.firstInstanceStatus = await evoFetch(`/instance/connectionState/${name}`)
      } catch (e) {
        results.firstInstanceStatus = { error: String(e) }
      }

      try {
        results.firstInstanceQR = await evoFetch(`/instance/connect/${name}`)
      } catch (e) {
        results.firstInstanceQR = { error: String(e) }
      }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
