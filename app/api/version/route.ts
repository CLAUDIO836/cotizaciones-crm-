import { NextResponse } from 'next/server'

// BUILD_ID se fija en tiempo de build — cambia con cada deploy
const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID })
}
