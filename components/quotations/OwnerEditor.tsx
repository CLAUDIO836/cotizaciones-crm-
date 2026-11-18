'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface Profile { id: string; name: string; role: string }

interface Props {
  quotationId: string
  currentUserId:   string
  currentUserName: string
}

export default function OwnerEditor({ quotationId, currentUserId, currentUserName }: Props) {
  const router    = useRouter()
  const [editing,   setEditing]   = useState(false)
  const [profiles,  setProfiles]  = useState<Profile[]>([])
  const [selected,  setSelected]  = useState(currentUserId)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!editing) return
    fetch('/api/profiles')
      .then(r => r.json())
      .then(d => setProfiles(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
  }, [editing])

  async function save() {
    if (selected === currentUserId) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await fetch('/api/quotations/set-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotation_id: quotationId, user_id: selected }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error')
      toast.success(`Propietario cambiado a ${d.new ?? ''}`)
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    const sellers = profiles.filter(p => ['vendedor', 'ejecutivo', 'admin', 'superadmin'].includes(p.role))
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          autoFocus
          className="text-sm border rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-green-200 max-w-[150px]"
        >
          {sellers.length === 0 && <option value={currentUserId}>{currentUserName}</option>}
          {sellers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => { setEditing(false); setSelected(currentUserId) }} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group">
      <p className="text-sm text-gray-800">{currentUserName}</p>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 ml-1"
        title="Cambiar ejecutivo"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}
