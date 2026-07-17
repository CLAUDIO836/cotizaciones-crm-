import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { email, password, name, role } = await req.json()

  // Admin client con service role key
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Actualizar rol (el trigger crea el perfil como vendedor, ajustamos si es admin)
  if (role === 'admin') {
    await adminSupabase.from('profiles').update({ role: 'admin', name }).eq('id', newUser.user.id)
  } else {
    await adminSupabase.from('profiles').update({ name }).eq('id', newUser.user.id)
  }

  const { data: newProfile } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', newUser.user.id)
    .single()

  return NextResponse.json({ profile: newProfile })
}
