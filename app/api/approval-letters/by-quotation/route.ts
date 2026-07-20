import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const quotationId = req.nextUrl.searchParams.get('quotation_id')
  if (!quotationId) return NextResponse.json({ letter: null })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: letters } = await supabase
    .from('approval_letters')
    .select('id, token, signed_at, signed_name, sent_at, created_at, client_name')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: false })

  if (!letters || letters.length === 0) return NextResponse.json({ letter: null })

  // Preferir carta firmada si existe
  const signed = letters.find(l => l.signed_at)
  const letter = signed ?? letters[0]

  return NextResponse.json({ letter })
}
