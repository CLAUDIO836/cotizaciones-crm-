'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Building2, Trash2 } from 'lucide-react'

interface Company { id: string; name: string; rut?: string }

export default function EmpresasPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<Company[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('companies').select('id, name, rut').order('name')
    setCompanies(data ?? [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!name.trim()) { toast.error('Ingresa el nombre de la empresa'); return }
    setLoading(true)
    const { error } = await supabase.from('companies').insert({ name: name.trim(), rut: rut.trim() || null })
    if (error) { toast.error('Error al crear empresa'); setLoading(false); return }
    toast.success('Empresa creada')
    setName(''); setRut(''); setShowForm(false)
    await load()
    setLoading(false)
  }

  async function handleDelete(id: string, companyName: string) {
    if (!confirm(`¿Eliminar "${companyName}"? Las cotizaciones asociadas quedarán sin empresa.`)) return
    const { error } = await supabase.from('companies').delete().eq('id', id)
    if (error) { toast.error('Error al eliminar'); return }
    toast.success('Empresa eliminada')
    await load()
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona las empresas del CRM</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} style={{ background: '#1B8A4B' }} className="text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Crear empresa
        </Button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-blue-700">Nueva empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Transportes XYZ" />
            </div>
            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input value={rut} onChange={e => setRut(e.target.value)} placeholder="76.000.000-0" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={loading} style={{ background: '#1B8A4B' }} className="text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setName(''); setRut('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {companies.map(c => (
          <div key={c.id} className="bg-white border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
              <Building2 className="w-5 h-5" style={{ color: '#1B8A4B' }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{c.name}</p>
              {c.rut && <p className="text-sm text-gray-400">RUT: {c.rut}</p>}
            </div>
            <button
              onClick={() => handleDelete(c.id, c.name)}
              className="text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
