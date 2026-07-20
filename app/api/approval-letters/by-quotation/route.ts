import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const quotationId = req.nextUrl.searchParams.get('quotation_id')
  if (!quotationId) return NextResponse.json({ letter: null })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: letter } = await supabase
    .from('approval_letters')
    .select('id, token, signed_at, signed_name, sent_at, created_at, client_name')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ letter: letter ?? null })
}
