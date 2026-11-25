'use client'

import { useState } from 'react'
import { MessageCircle, FileText } from 'lucide-react'
import LeadRequestsPanel from './LeadRequestsPanel'
import WaConversacionesSinFormulario from './WaConversacionesSinFormulario'
import type { LeadRequest, WaSolicitud, UserSession } from '@/lib/api'

type Seller = { id: string; name: string }

export default function SolicitudesTabs({
  leads,
  sellers,
  waConvs,
}: {
  leads: LeadRequest[]
  sellers: UserSession[]
  waConvs: WaSolicitud[]
}) {
  const [tab, setTab] = useState<'completas' | 'wa'>('completas')

  const pendingLeads = leads.filter(l => l.status === 'pendiente').length
  const waCount      = waConvs.filter(c => !c.has_lead).length

  return (
    <div className="space-y-4">
      {/* Pestañas */}
      <div className="flex gap-2 border-b" style={{ borderColor: '#e5e7eb' }}>
        <TabButton
          active={tab === 'completas'}
          onClick={() => setTab('completas')}
          icon={<FileText className="w-4 h-4" />}
          label="Consultas recibidas"
          badge={pendingLeads}
          badgeColor="#ef4444"
        />
        <TabButton
          active={tab === 'wa'}
          onClick={() => setTab('wa')}
          icon={<MessageCircle className="w-4 h-4" />}
          label="Consultas recibidas en WA"
          badge={waCount}
          badgeColor="#25D366"
        />
      </div>

      {/* Contenido */}
      {tab === 'completas' && (
        <LeadRequestsPanel leads={leads} sellers={sellers as Seller[]} />
      )}
      {tab === 'wa' && (
        <WaConversacionesSinFormulario convs={waConvs} />
      )}
    </div>
  )
}

function TabButton({
  active, onClick, icon, label, badge, badgeColor,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge: number
  badgeColor: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px"
      style={active
        ? { color: '#1B8A4B', borderBottomColor: '#1B8A4B' }
        : { color: '#6b7280', borderBottomColor: 'transparent' }}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none"
          style={{ background: badgeColor }}>
          {badge}
        </span>
      )}
    </button>
  )
}
