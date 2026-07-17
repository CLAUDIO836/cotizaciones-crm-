'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'

interface Note {
  id: string
  content: string
  created_at: string
  user_name?: string
}

interface Props {
  quotationId: string
  initialNotes: Note[]
  userId: string
}

export default function NotesPanel({ quotationId, initialNotes, userId }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [newContent, setNewContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const supabase = createClient()

  async function handleAdd() {
    if (!newContent.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .insert({ quotation_id: quotationId, user_id: userId, content: newContent.trim() })
      .select('*')
      .single()
    if (!error && data) {
      setNotes(prev => [data, ...prev])
      setNewContent('')
    }
    setLoading(false)
  }

  async function handleEdit(id: string) {
    if (!editContent.trim()) return
    const { error } = await supabase
      .from('notes')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, content: editContent.trim() } : n))
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error) setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Notas</h3>

      {/* New note */}
      <div className="bg-gray-50 rounded-xl border p-3 space-y-2">
        <textarea
          placeholder="Añadir una nota..."
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          rows={3}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder-gray-400"
        />
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={loading || !newContent.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-40"
            style={{ background: '#1B8A4B' }}
          >
            <Plus className="w-3.5 h-3.5" />
            {loading ? 'Guardando...' : 'Añadir nota'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No hay notas</p>
        )}
        {notes.map(note => (
          <div key={note.id} className="bg-white rounded-xl border p-4 group">
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full text-sm border rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-200"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEdit(note.id)} className="text-green-600 hover:text-green-700">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <p className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                    className="text-gray-300 hover:text-gray-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(note.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {new Date(note.created_at).toLocaleString('es-CL', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
