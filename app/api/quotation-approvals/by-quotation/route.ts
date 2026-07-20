import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const quotationId = req.nextUrl.searchParams.get('quotation_id')
  if (!quotationId) return NextResponse.json({ approval: null })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: approvals } = await supabase
    .from('quotation_approvals')
    .select('id, token, response, responded_at, responded_name, rejection_reason, sent_at, created_at, client_name')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: false })

  if (!approvals || approvals.length === 0) return NextResponse.json({ approval: null })

  // Prefer responded approval if exists
  const responded = approvals.find(a => a.response)
  return NextResponse.json({ approval: responded ?? approvals[0] })
}
