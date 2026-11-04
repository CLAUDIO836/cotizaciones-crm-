'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileCheck, Users, UserCog, LogOut, Filter,
  BarChart3, CalendarDays, Inbox, Bot, PhoneCall, Phone, MessageCircle,
  Calculator, ShieldCheck, ChevronDown, ChevronLeft, ChevronRight,
  Briefcase,
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

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'superadmin'

  const onBandeja   = pathname.startsWith('/bandeja')
  const currentExec = onBandeja ? (searchParams.get('exec') ?? 'todos') : ''

  const [execOpen,   setExecOpen]   = useState(onBandeja)
  const [execAgents, setExecAgents] = useState<{ id: string; name: string }[]>([])
  const [collapsed,  setCollapsed]  = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_collapsed') === '1'
  })

  useEffect(() => { if (onBandeja) setExecOpen(true) }, [onBandeja])

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; name: string; active: number; role?: string }[]) =>
        setExecAgents(rows.filter(r => r.active && r.role !== 'admin').map(r => ({ id: r.id, name: r.name })))
      )
      .catch(() => {})
  }, [])

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
      return next
    })
  }

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

  // ── Shared style helpers ──────────────────────────────────────────────────
  function itemStyle(active: boolean) {
    return active
      ? { background: 'rgba(27,138,75,0.15)', color: '#1B8A4B' }
      : { color: 'rgba(255,255,255,0.55)' }
  }

  function NavItem({
    href, icon: Icon, label, badgeCount, active,
  }: {
    href: string; icon: React.ElementType; label: string
    badgeCount?: number; active: boolean
  }) {
    return (
      <Link href={href}
        title={collapsed ? label : undefined}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative"
        style={itemStyle(active)}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && badgeCount ? (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
            {badgeCount}
          </span>
        ) : null}
        {collapsed && badgeCount ? (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500 rounded-full" />
        ) : null}
      </Link>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    if (collapsed) return <div className="my-1 mx-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
    return (
      <div className="px-3 pt-3 pb-0.5">
        <span className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.22)' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <aside
      className="flex flex-col py-3 transition-all duration-200"
      style={{
        background: '#16192A',
        width: collapsed ? 56 : 220,
        minWidth: collapsed ? 56 : 220,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`flex items-center mb-4 px-3 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#1B8A4B' }}>
          <span className="text-white font-black text-sm">T</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none">CRM</p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {process.env.NEXT_PUBLIC_COMPANY_NAME}
            </p>
          </div>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">

        {/* COMERCIAL */}
        <SectionLabel label="Comercial" />
        <NavItem href="/dashboard"      icon={LayoutDashboard} label="Dashboard"   active={isActive('/dashboard')} />
        <NavItem href="/prospectos"     icon={PhoneCall}       label="Prospectos"  active={isActive('/prospectos')} />
        <NavItem href="/cotizaciones"   icon={Briefcase}       label="Negocios"    active={isActive('/cotizaciones')} />
        <NavItem href="/cotizador"      icon={Calculator}      label="Cotizador"   active={isActive('/cotizador')} />
        <NavItem href="/autorizaciones" icon={ShieldCheck}     label="Por aprobar" active={isActive('/autorizaciones')}
          badgeCount={profile?.autz_pending} />

        {/* COMUNICACIONES */}
        <SectionLabel label="Comunicaciones" />

        {/* Bandeja WA con submenú */}
        <div>
          <button
            title={collapsed ? 'Bandeja WA' : undefined}
            onClick={() => { setExecOpen(o => !o); if (!onBandeja) router.push('/bandeja') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={itemStyle(onBandeja)}
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Bandeja WA</span>
                <ChevronDown className="w-3 h-3 transition-transform flex-shrink-0"
                  style={{ transform: execOpen ? 'rotate(180deg)' : 'none', opacity: 0.5 }} />
              </>
            )}
          </button>
          {execOpen && !collapsed && (
            <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l pl-2"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {subItems.map(item => (
                <Link key={item.id} href={`/bandeja?exec=${item.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={currentExec === item.id
                    ? { background: 'rgba(27,138,75,0.12)', color: '#1B8A4B' }
                    : { color: 'rgba(255,255,255,0.4)' }
                  }
                >
                  <span className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: currentExec === item.id ? '#1B8A4B' : 'rgba(255,255,255,0.2)' }} />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <NavItem href="/llamadas"  icon={Phone}         label="Llamadas"  active={isActive('/llamadas')} />
        <NavItem href="/whatsapp"  icon={MessageCircle} label="WhatsApp"  active={isActive('/whatsapp')} />
        <NavItem href="/agenda"    icon={CalendarDays}  label="Agenda"    active={isActive('/agenda')} />
        <NavItem href="/agente"    icon={Bot}           label="Agente IA" active={isActive('/agente')}
          badgeCount={profile?.agent_attention} />

        {/* GESTIÓN */}
        <SectionLabel label="Gestión" />
        <NavItem href="/solicitudes" icon={Inbox}     label="Solicitudes" active={isActive('/solicitudes')}
          badgeCount={profile?.pending_leads} />
        <NavItem href="/contratos"   icon={FileCheck} label="Contratos"   active={isActive('/contratos')} />
        <NavItem href="/clientes"    icon={Users}     label="Clientes"    active={isActive('/clientes')} />

        {/* ADMIN */}
        {isAdmin && (
          <>
            <SectionLabel label="Admin" />
            <NavItem href="/reportes"       icon={BarChart3} label="Reportes" active={isActive('/reportes')} />
            <NavItem href="/admin/usuarios" icon={UserCog}   label="Usuarios" active={isActive('/admin/usuarios')} />
            <NavItem href="/admin/embudos"  icon={Filter}    label="Embudos"  active={isActive('/admin/embudos')} />
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-2 pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Toggle collapse */}
        <button onClick={toggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-white/8 mb-1"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 flex-shrink-0" />
            : <><ChevronLeft className="w-4 h-4 flex-shrink-0" /><span className="text-xs">Colapsar</span></>
          }
        </button>

        {/* User + logout */}
        <div className={`flex items-center gap-2.5 px-3 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0"
            style={{ background: '#1B8A4B' }} title={profile?.name ?? ''}>
            {profile?.name?.[0] ?? '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {profile?.name}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
              </p>
            </div>
          )}
          <button onClick={handleLogout} title="Cerrar sesión"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 flex-shrink-0">
            <LogOut className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          </button>
        </div>
      </div>
    </aside>
  )
}
