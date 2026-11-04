'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileText, FileCheck, Users, UserCog, LogOut, Filter,
  BarChart3, CalendarDays, Inbox, Bot, PhoneCall, Phone, MessageCircle,
  Calculator, ShieldCheck, ChevronDown, ChevronLeft, ChevronRight, Briefcase,
} from 'lucide-react'

interface Profile {
  id: string
  name: string
  role: string
  pending_leads?: number
  agent_attention?: number
  autz_pending?: number
}

const ROLE_LABELS: Record<string, string> = {
  superadmin:  'Superadmin',
  admin:       'Admin',
  vendedor:    'Ejecutivo',
  ejecutivo:   'Ejecutivo',
  coordinador: 'Coordinador',
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: 'rgba(255,255,255,0.22)' }}>
        {label}
      </span>
    </div>
  )
}

function NavLink({
  href, label, icon: Icon, badgeCount, isActive,
}: {
  href: string; label: string; icon: React.ElementType
  badgeCount?: number; isActive: boolean
}) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
      style={isActive
        ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
        : { color: 'rgba(255,255,255,0.5)' }
      }
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badgeCount ? (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
          {badgeCount}
        </span>
      ) : null}
    </Link>
  )
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'superadmin'

  const onBandeja    = pathname.startsWith('/bandeja')
  const currentExec  = onBandeja ? (searchParams.get('exec') ?? 'todos') : ''

  const [execOpen,   setExecOpen]   = useState(onBandeja)
  const [execAgents, setExecAgents] = useState<{ id: string; name: string }[]>([])
  const [collapsed,  setCollapsed]  = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_collapsed') === '1'
  })

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
      return next
    })
  }

  useEffect(() => { if (onBandeja) setExecOpen(true) }, [onBandeja])

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; name: string; active: number; role?: string }[]) =>
        setExecAgents(rows.filter(r => r.active && r.role !== 'admin').map(r => ({ id: r.id, name: r.name })))
      )
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const subItems = [
    { id: 'todos',      label: 'Todos' },
    { id: 'sinasignar', label: 'Sin asignar' },
    ...execAgents.map(a => ({ id: a.id, label: a.name.split(' ')[0] })),
  ]

  // ── Icon rail items (en orden de sección) ──────────────────────────────────
  const iconRailItems = [
    // Comercial
    { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/prospectos',     icon: PhoneCall,       label: 'Prospectos' },
    { href: '/cotizaciones',   icon: Briefcase,       label: 'Negocios' },
    { href: '/cotizador',      icon: Calculator,      label: 'Cotizador' },
    { href: '/autorizaciones', icon: ShieldCheck,     label: 'Por aprobar', autzBadge: true },
    // Comunicaciones
    { href: '/bandeja',        icon: MessageCircle,   label: 'Bandeja WA' },
    { href: '/llamadas',       icon: Phone,           label: 'Llamadas' },
    { href: '/whatsapp',       icon: MessageCircle,   label: 'WhatsApp' },
    { href: '/agenda',         icon: CalendarDays,    label: 'Agenda' },
    { href: '/agente',         icon: Bot,             label: 'Agente IA', agentBadge: true },
    // Gestión
    { href: '/solicitudes',    icon: Inbox,           label: 'Solicitudes', badge: true },
    { href: '/contratos',      icon: FileCheck,       label: 'Contratos' },
    { href: '/clientes',       icon: Users,           label: 'Clientes' },
  ]

  function getBadgeCount(item: typeof iconRailItems[0]) {
    if (item.badge)      return profile?.pending_leads
    if (item.agentBadge) return profile?.agent_attention
    if (item.autzBadge)  return profile?.autz_pending
    return 0
  }

  return (
    <aside className="flex" style={{ background: '#16192A' }}>
      {/* ── Icon rail ─────────────────────────────────────────────────── */}
      <div className="w-14 flex flex-col items-center py-4 gap-1"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo + toggle */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: '#1B8A4B' }}>
          <span className="text-white font-black text-sm">T</span>
        </div>
        <button onClick={toggleCollapse} title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-9 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 mb-2">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            : <ChevronLeft  className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          }
        </button>

        {iconRailItems.map(({ href, icon: Icon, label, ...rest }) => {
          const bc = getBadgeCount({ href, icon: Icon, label, ...rest })
          const active = href === '/bandeja' ? onBandeja : isActive(href)
          return (
            <Link key={href} href={href} title={label}>
              <div className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={active ? { background: '#1B8A4B' } : {}}>
                <Icon className="w-4 h-4"
                  style={{ color: active ? 'white' : 'rgba(255,255,255,0.45)' }} />
                {bc ? (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">
                    {bc}
                  </span>
                ) : null}
              </div>
            </Link>
          )
        })}

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

        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase cursor-pointer mb-1"
          style={{ background: '#1B8A4B' }} title={profile?.name ?? ''}>
          {profile?.name?.[0] ?? '?'}
        </div>
        <button onClick={handleLogout} title="Cerrar sesión"
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-white/10">
          <LogOut className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
        </button>
      </div>

      {/* ── Label panel ───────────────────────────────────────────────── */}
      <div className="flex flex-col py-4"
        style={{
          background: '#1C2033',
          overflow: 'hidden',
          width: collapsed ? 0 : 160,
          minWidth: collapsed ? 0 : 160,
          transition: 'width 0.2s ease, min-width 0.2s ease',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
        <div className="px-4 mb-4">
          <p className="text-white font-bold text-sm">CRM</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {process.env.NEXT_PUBLIC_COMPANY_NAME}
          </p>
        </div>

        <div className="flex flex-col gap-0.5 px-2" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── COMERCIAL ── */}
          <SectionLabel label="Comercial" />
          <NavLink href="/dashboard"      label="Dashboard"    icon={LayoutDashboard} isActive={isActive('/dashboard')} />
          <NavLink href="/prospectos"     label="Prospectos"   icon={PhoneCall}       isActive={isActive('/prospectos')} />
          <NavLink href="/cotizaciones"   label="Negocios"     icon={Briefcase}       isActive={isActive('/cotizaciones')} />
          <NavLink href="/cotizador"      label="Cotizador"    icon={Calculator}      isActive={isActive('/cotizador')} />
          <NavLink href="/autorizaciones" label="Por aprobar"  icon={ShieldCheck}     isActive={isActive('/autorizaciones')}
            badgeCount={profile?.autz_pending} />

          {/* ── COMUNICACIONES ── */}
          <SectionLabel label="Comunicaciones" />

          {/* Bandeja WA con submenú */}
          <div>
            <button
              onClick={() => { setExecOpen(o => !o); if (!onBandeja) router.push('/bandeja') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={onBandeja
                ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                : { color: 'rgba(255,255,255,0.5)' }
              }
            >
              <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">Bandeja WA</span>
              <ChevronDown className="w-3 h-3 transition-transform"
                style={{ transform: execOpen ? 'rotate(180deg)' : 'none', opacity: 0.6 }} />
            </button>
            {execOpen && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-2"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {subItems.map(item => (
                  <Link key={item.id} href={`/bandeja?exec=${item.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={currentExec === item.id
                      ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
                      : { color: 'rgba(255,255,255,0.4)' }
                    }
                  >
                    <span className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ background: currentExec === item.id ? '#1B8A4B' : 'rgba(255,255,255,0.25)' }} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <NavLink href="/llamadas"  label="Llamadas"  icon={Phone}         isActive={isActive('/llamadas')} />
          <NavLink href="/whatsapp"  label="WhatsApp"  icon={MessageCircle} isActive={isActive('/whatsapp')} />
          <NavLink href="/agenda"    label="Agenda"    icon={CalendarDays}  isActive={isActive('/agenda')} />
          <NavLink href="/agente"    label="Agente IA" icon={Bot}           isActive={isActive('/agente')}
            badgeCount={profile?.agent_attention} />

          {/* ── GESTIÓN ── */}
          <SectionLabel label="Gestión" />
          <NavLink href="/solicitudes" label="Solicitudes" icon={Inbox}     isActive={isActive('/solicitudes')}
            badgeCount={profile?.pending_leads} />
          <NavLink href="/contratos"   label="Contratos"   icon={FileCheck} isActive={isActive('/contratos')} />
          <NavLink href="/clientes"    label="Clientes"    icon={Users}     isActive={isActive('/clientes')} />

          {/* ── ADMIN ── */}
          {isAdmin && (
            <>
              <SectionLabel label="Admin" />
              <NavLink href="/reportes"       label="Reportes" icon={BarChart3} isActive={isActive('/reportes')} />
              <NavLink href="/admin/usuarios" label="Usuarios" icon={UserCog}   isActive={isActive('/admin/usuarios')} />
              <NavLink href="/admin/embudos"  label="Embudos"  icon={Filter}    isActive={isActive('/admin/embudos')} />
            </>
          )}
        </div>

        <div className="px-4 pb-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
