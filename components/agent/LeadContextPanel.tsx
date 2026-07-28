import type { AiConversationDetail } from '@/lib/ai-api'
import type { LucideIcon } from 'lucide-react'
import { MapPin, Users, Calendar, Building2, User, Phone, Mail, Truck } from 'lucide-react'

function Row({ icon: Icon, label, value }: {
  icon: LucideIcon
  label: string
  value?: string | number | null
}) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-2.5 text-sm">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className="text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

export default function LeadContextPanel({ conv }: { conv: AiConversationDetail }) {
  const hasLead = Boolean(conv.lead_id)
  const diasStr = Array.isArray(conv.dias_semana) ? conv.dias_semana.join(', ') : undefined

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Contexto del lead</p>

      {!hasLead && (
        <p className="text-xs text-gray-400">Sin lead vinculado</p>
      )}

      {hasLead && (
        <>
          <Section title="Empresa">
            <Row icon={Building2} label="Razón social" value={conv.empresa_nombre} />
            <Row icon={Building2} label="Empresa destino" value={conv.target_company} />
          </Section>

          <Section title="Contacto">
            <Row icon={User}  label="Nombre"    value={conv.contacto_nombre} />
            <Row icon={Phone} label="Teléfono"  value={conv.contacto_telefono} />
            <Row icon={Mail}  label="Email"     value={conv.contacto_email} />
          </Section>

          <Section title="Servicio solicitado">
            <Row icon={Truck}    label="Tipo"         value={conv.tipo_servicio} />
            <Row icon={MapPin}   label="Ruta"
              value={conv.desde && conv.hasta ? `${conv.desde} → ${conv.hasta}` : (conv.desde ?? conv.hasta)} />
            <Row icon={Users}    label="Pasajeros"    value={conv.pasajeros_aprox} />
            <Row icon={Calendar} label="Fecha inicio" value={conv.fecha_inicio} />
            <Row icon={Truck}    label="Vehículo"     value={conv.vehiculo_preferido} />
            {diasStr && (
              <Row icon={Calendar} label="Días" value={diasStr} />
            )}
            <Row icon={Calendar} label="Frecuencia"  value={conv.frecuencia} />
          </Section>

          {conv.observaciones && (
            <Section title="Observaciones">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{conv.observaciones}</p>
            </Section>
          )}
        </>
      )}

      {!hasLead && conv.client_name && (
        <Section title="Cliente">
          <Row icon={Building2} label="Nombre" value={conv.client_name} />
        </Section>
      )}
    </div>
  )
}
