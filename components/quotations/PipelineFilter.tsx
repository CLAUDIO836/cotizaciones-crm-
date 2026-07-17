'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Users, Filter } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface Pipeline { id: string; name: string; color: string }
interface Vendedor { id: string; name: string }
interface Company { id: string; name: string }

interface Props {
  pipelines: Pipeline[]
  vendedores: Vendedor[]
  companies: Company[]
  currentPipeline?: string
  currentVendedor?: string
  currentCompany?: string
  currentParams: Record<string, string | undefined>
  isAdmin: boolean
}

export default function PipelineFilter({
  pipelines, vendedores, companies, currentPipeline, currentVendedor, currentCompany, currentParams, isAdmin
}: Props) {
  const router = useRouter()
  const [openPipeline, setOpenPipeline] = useState(false)
  const [openVendedor, setOpenVendedor] = useState(false)
  const [openCompany, setOpenCompany] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)
  const vendedorRef = useRef<HTMLDivElement>(null)
  const companyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) setOpenPipeline(false)
      if (vendedorRef.current && !vendedorRef.current.contains(e.target as Node)) setOpenVendedor(false)
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setOpenCompany(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function navigate(key: string, value: string | undefined) {
    const next = { ...currentParams, [key]: value }
    if (!value) delete next[key]
    const params = new URLSearchParams(
      Object.entries(next).filter(([, v]) => Boolean(v)) as [string, string][]
    )
    router.push(`/cotizaciones?${params.toString()}`)
  }

  const activePipeline = pipelines.find(p => p.id === currentPipeline)
  const activeVendedor = vendedores.find(v => v.id === currentVendedor)
  const activeCompany = companies.find(c => c.id === currentCompany)

  return (
    <div className="bg-white border-b px-6 py-2 flex items-center gap-3 flex-wrap">

      {/* Empresa dropdown */}
      <div className="relative" ref={companyRef}>
        <button
          onClick={() => { setOpenCompany(v => !v); setOpenPipeline(false); setOpenVendedor(false) }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-gray-50"
          style={activeCompany
            ? { borderColor: '#6366f1', color: '#6366f1', background: '#eef2ff' }
            : { borderColor: '#e5e7eb', color: '#374151' }
          }
        >
          🏢 {activeCompany ? activeCompany.name : 'Todas las empresas'}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
        {openCompany && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            <button
              onClick={() => { navigate('company', undefined); setOpenCompany(false) }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 font-medium"
              style={{ color: !currentCompany ? '#6366f1' : '#374151' }}
            >
              Todas las empresas {!currentCompany && '✓'}
            </button>
            {companies.map(c => (
              <button key={c.id}
                onClick={() => { navigate('company', c.id); setOpenCompany(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                style={{ color: currentCompany === c.id ? '#6366f1' : '#374151' }}
              >
                {c.name} {currentCompany === c.id && '✓'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Embudos dropdown */}
      <div className="relative" ref={pipelineRef}>
        <button
          onClick={() => { setOpenPipeline(v => !v); setOpenVendedor(false) }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-gray-50"
          style={activePipeline
            ? { borderColor: activePipeline.color, color: activePipeline.color, background: `${activePipeline.color}12` }
            : { borderColor: '#e5e7eb', color: '#374151' }
          }
        >
          <Filter className="w-3.5 h-3.5" />
          {activePipeline ? activePipeline.name : 'Todos los embudos'}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>

        {openPipeline && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            <button
              onClick={() => { navigate('pipeline', undefined); setOpenPipeline(false) }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5 font-medium"
              style={{ color: !currentPipeline ? '#1B8A4B' : '#374151' }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              Todos los embudos
              {!currentPipeline && <span className="ml-auto text-xs">✓</span>}
            </button>
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => { navigate('pipeline', p.id); setOpenPipeline(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5"
                style={{ color: currentPipeline === p.id ? p.color : '#374151' }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                {p.name}
                {currentPipeline === p.id && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vendedores dropdown — solo admin */}
      {isAdmin && (
        <div className="relative" ref={vendedorRef}>
          <button
            onClick={() => { setOpenVendedor(v => !v); setOpenPipeline(false) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-gray-50"
            style={activeVendedor
              ? { borderColor: '#1B8A4B', color: '#1B8A4B', background: '#1B8A4B12' }
              : { borderColor: '#e5e7eb', color: '#374151' }
            }
          >
            <Users className="w-3.5 h-3.5" />
            {activeVendedor ? activeVendedor.name : 'Todos los usuarios'}
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {openVendedor && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => { navigate('vendedor', undefined); setOpenVendedor(false) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5 font-medium"
                style={{ color: !currentVendedor ? '#1B8A4B' : '#374151' }}
              >
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <Users className="w-3 h-3 text-gray-500" />
                </div>
                Todos los usuarios
                {!currentVendedor && <span className="ml-auto text-xs text-green-600">✓</span>}
              </button>
              {vendedores.map(v => (
                <button
                  key={v.id}
                  onClick={() => { navigate('vendedor', v.id); setOpenVendedor(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2.5"
                  style={{ color: currentVendedor === v.id ? '#1B8A4B' : '#374151' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0"
                    style={{ background: '#1B8A4B' }}
                  >
                    {v.name[0]}
                  </div>
                  {v.name}
                  {currentVendedor === v.id && <span className="ml-auto text-xs text-green-600">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indicador de filtros activos */}
      {(currentPipeline || currentVendedor || currentCompany) && (
        <button
          onClick={() => {
            navigate('pipeline', undefined)
            navigate('vendedor', undefined)
          }}
          className="text-xs text-gray-400 hover:text-red-500 underline ml-1"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
