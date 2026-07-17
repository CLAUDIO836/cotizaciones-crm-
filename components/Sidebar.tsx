'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, FileText, FileCheck, Users, UserCog, LogOut, Filter, BarChart3, CalendarDays
} from 'lucide-react'

interface Profile {
  id: string
  name: string
  role: string
}

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/cotizaciones', label: 'Negocios',     icon: FileText },
  { href: '/agenda',       label: 'Agenda',       icon: CalendarDays },
  { href: '/contratos',    label: 'Contratos',    icon: FileCheck },
  { href: '/clientes',     label: 'Clientes',     icon: Users },
]

const ROLE_LABELS: Record<string, string> = {
  superadmin:  'Superadmin',
  admin:       'Admin',
  vendedor:    'Ejecutivo',
  ejecutivo:   'Ejecutivo',
  coordinador: 'Coordinador',
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <aside className="flex" style={{ background: '#16192A' }}>
      {/* Icon rail */}
      <div className="w-14 flex flex-col items-center py-4 gap-1" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
          style={{ background: '#1B8A4B' }}>
          <span className="text-white font-black text-sm">T</span>
        </div>

        {/* Nav icons */}
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} title={label}>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={isActive(href) ? { background: '#1B8A4B' } : {}}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: isActive(href) ? 'white' : 'rgba(255,255,255,0.45)' }}
              />
            </div>
          </Link>
        ))}

        {isAdmin && (
          <>
            <Link href="/reportes" title="Reportes">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={isActive('/reportes') ? { background: '#1B8A4B' } : {}}>
                <BarChart3 className="w-4 h-4"
                  style={{ color: isActive('/reportes') ? 'white' : 'rgba(255,255,255,0.45)' }} />
              </div>
            </Link>
            <Link href="/admin/usuarios" title="Usuarios">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={isActive('/admin/usuarios') ? { background: '#1B8A4B' } : {}}>
                <UserCog className="w-4 h-4"
                  style={{ color: isActive('/admin/usuarios') ? 'white' : 'rgba(255,255,255,0.45)' }} />
              </div>
            </Link>
            <Link href="/admin/embudos" title="Embudos">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={isActive('/admin/embudos') ? { background: '#1B8A4B' } : {}}>
                <Filter className="w-4 h-4"
                  style={{ color: isActive('/admin/embudos') ? 'white' : 'rgba(255,255,255,0.45)' }} />
              </div>
            </Link>
          </>
        )}

        <div className="flex-1" />
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase cursor-pointer mb-1"
          style={{ background: '#1B8A4B' }}
          title={profile?.name ?? ''}
        >
          {profile?.name?.[0] ?? '?'}
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
        >
          <LogOut className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
        </button>
      </div>

      {/* Label panel */}
      <div className="w-40 flex flex-col py-4" style={{ background: '#1C2033' }}>
        <div className="px-4 mb-5">
          <p className="text-white font-bold text-sm">CRM</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {process.env.NEXT_PUBLIC_COMPANY_NAME}
          </p>
        </div>

        <div className="flex flex-col gap-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={isActive(href)
                ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                : { color: 'rgba(255,255,255,0.5)' }
              }
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="my-2 mx-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <Link href="/reportes"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={isActive('/reportes')
                  ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                  : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
                Reportes
              </Link>
              <Link href="/admin/usuarios"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={isActive('/admin/usuarios')
                  ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                  : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <UserCog className="w-3.5 h-3.5 flex-shrink-0" />
                Usuarios
              </Link>
              <Link href="/admin/embudos"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={isActive('/admin/embudos')
                  ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                  : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <Filter className="w-3.5 h-3.5 flex-shrink-0" />
                Embudos
              </Link>
            </>
          )}
        </div>

        <div className="flex-1" />
        <div className="px-4 pb-2">
          <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {profile?.name}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
          </p>
        </div>
      </div>
    </aside>
  )
}
