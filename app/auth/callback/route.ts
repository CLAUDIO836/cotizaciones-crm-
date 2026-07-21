import { NextRequest, NextResponse } from 'next/server'

// OAuth callback no longer used — authentication is now handled by crm-api.php
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`)
}
