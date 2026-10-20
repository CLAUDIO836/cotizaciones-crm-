'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface ParsedRow {
  name: string
  commune: string
  phone: string
  rbd?: string
  contacts: { name: string; role: string; email: string; phone: string }[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect header row
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idx = {
    name:    header.findIndex(h => h.includes('nombre') || h.includes('colegio') || h === 'name'),
    commune: header.findIndex(h => h.includes('comuna') || h === 'commune'),
    phone:   header.findIndex(h => h.includes('telef') || h.includes('phone') || h.includes('tele')),
    celular: header.findIndex(h => h.includes('celular') || h.includes('movil') || h.includes('cel')),
    rbd:     header.findIndex(h => h === 'rbd'),
    cname:   header.findIndex(h => h.includes('nombre') && !h.includes('colegio') && header.indexOf(h) > 1
                              || h === 'nombre_contacto' || h === 'contact'),
    cargo:   header.findIndex(h => h.includes('cargo') || h.includes('role') || h.includes('puesto')),
    email:   header.findIndex(h => h.includes('mail') || h.includes('correo') || h.includes('email')),
  }

  // If no name/commune detected try positional (NOMBRE,COMUNA,TELEFONO,NOMBRE_CONTACTO,CARGO,EMAIL)
  if (idx.name < 0) idx.name = 0
  if (idx.commune < 0) idx.commune = 1
  if (idx.phone < 0) idx.phone = 2
  if (idx.cname < 0) idx.cname = 3
  if (idx.cargo < 0) idx.cargo = 4
  if (idx.email < 0) idx.email = 5

  const map = new Map<string, ParsedRow>()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const name = cols[idx.name] || ''
    const commune = cols[idx.commune] || ''
    if (!name || !commune) continue

    const key = `${name.toLowerCase()}||${commune.toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, {
        name,
        commune,
        phone: idx.phone >= 0 ? (cols[idx.phone] || '') : '',
        rbd:   idx.rbd >= 0 ? (cols[idx.rbd] || undefined) : undefined,
        contacts: [],
      })
    }

    const row = map.get(key)!
    const cname = idx.cname >= 0 ? cols[idx.cname] : ''
    const phone = idx.celular >= 0 ? (cols[idx.celular] || cols[idx.phone] || '') : (cols[idx.phone] || '')
    if (cname) {
      row.contacts.push({
        name:  cname,
        role:  idx.cargo >= 0 ? (cols[idx.cargo] || '') : '',
        email: idx.email >= 0 ? (cols[idx.email] || '') : '',
        phone,
      })
    }
  }

  return Array.from(map.values())
}

export default function ImportarCSV({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [csvText, setCsvText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvText(text)
      try {
        const rows = parseCSV(text)
        setPreview(rows)
        setError('')
      } catch {
        setError('No se pudo parsear el CSV. Revisa el formato.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function doImport() {
    if (!preview?.length) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/prospectos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, prospects: preview }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al importar')
      setResult({ imported: data.imported ?? preview.length, skipped: data.skipped ?? 0 })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Importación completada</h2>
        <p className="text-gray-600 mb-1">{result.imported} colegios importados</p>
        {result.skipped > 0 && <p className="text-gray-400 text-sm">{result.skipped} ya existían y fueron omitidos</p>}
        <button
          onClick={() => router.push(`/prospectos/${campaignId}`)}
          className="mt-6 px-6 py-2.5 text-white text-sm font-semibold rounded-xl"
          style={{ background: '#1B8A4B' }}>
          Ver cola de llamados
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importar CSV → {campaignName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sube un archivo CSV con los colegios a prospectar</p>
        </div>
      </div>

      {/* Format instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">Formato esperado del CSV (una fila por contacto):</p>
        <code className="block text-xs bg-blue-100 rounded p-2 mt-1 font-mono">
          NOMBRE_COLEGIO,COMUNA,TELEFONO,NOMBRE_CONTACTO,CARGO,EMAIL
        </code>
        <p className="mt-2 text-xs text-blue-600">
          Si el colegio tiene varios contactos, repite el nombre y comuna en filas consecutivas. También acepta columnas RBD y CELULAR.
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent('NOMBRE_COLEGIO,COMUNA,TELEFONO,NOMBRE_CONTACTO,CARGO,EMAIL,CELULAR,RBD\nColegio San Martín,MAIPÚ,22612345,Juan Pérez,DIRECTOR,director@colegio.cl,9876543210,12345\nColegio San Martín,MAIPÚ,22612345,Ana López,UTP,utp@colegio.cl,,\n')}`}
          download="plantilla_colegios.csv"
          className="inline-flex items-center gap-1.5 mt-2 text-blue-700 hover:text-blue-900 font-medium text-xs"
        >
          <Download className="w-3.5 h-3.5" /> Descargar plantilla
        </a>
      </div>

      {/* Drop zone */}
      {!preview ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-green-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Arrastra tu CSV aquí o haz clic para seleccionar</p>
          <p className="text-gray-400 text-sm mt-1">Exporta desde Google Sheets: Archivo → Descargar → CSV</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      ) : (
        <div>
          {/* Summary */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">{preview.length} colegios detectados</p>
            <button onClick={() => { setPreview(null); setCsvText('') }}
              className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs">
              <X className="w-3.5 h-3.5" /> Cambiar archivo
            </button>
          </div>

          {/* Preview table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Colegio</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Comuna</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Contactos</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800 truncate max-w-[180px]">{row.name}</td>
                      <td className="px-4 py-2 text-gray-600">{row.commune}</td>
                      <td className="px-4 py-2 text-gray-400">{row.contacts.length}</td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 50 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Mostrando 50 de {preview.length}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={doImport}
            disabled={loading}
            className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60"
            style={{ background: '#1B8A4B' }}>
            {loading ? 'Importando...' : `Importar ${preview.length} colegios a "${campaignName}"`}
          </button>
        </div>
      )}
    </div>
  )
}
