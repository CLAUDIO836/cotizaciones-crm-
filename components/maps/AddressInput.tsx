'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'

// Dirección con autocompletado de Google Maps (vía /api/places).
// Al elegir una sugerencia entrega place_id, coordenadas y comuna.

export interface PlaceSelection {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  comuna?: string
}

interface Prediction { description: string; place_id: string }
interface AddressComponent { long_name: string; types: string[] }

function comunaDe(components: AddressComponent[] | undefined): string | undefined {
  if (!components) return undefined
  const pick = (t: string) => components.find(c => c.types.includes(t))?.long_name
  return pick('administrative_area_level_3') ?? pick('locality') ?? pick('administrative_area_level_2')
}

export default function AddressInput({ value, onChange, placeholder, id }: {
  value: PlaceSelection
  onChange: (sel: PlaceSelection) => void
  placeholder?: string
  id?: string
}) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    onChange({ address: v })          // al escribir se pierde la ubicación precisa
    clearTimeout(timer.current)
    if (v.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(v)}`)
        const data = await res.json()
        const preds: Prediction[] = (data.predictions ?? []).map((p: Prediction) => ({ description: p.description, place_id: p.place_id }))
        setSuggestions(preds); setOpen(preds.length > 0)
      } catch { setSuggestions([]); setOpen(false) }
    }, 350)
  }

  async function select(pred: Prediction) {
    setSuggestions([]); setOpen(false)
    onChange({ address: pred.description, placeId: pred.place_id })
    try {
      const res = await fetch(`/api/places?place_id=${encodeURIComponent(pred.place_id)}`)
      const data = await res.json()
      const loc = data.result?.geometry?.location
      onChange({
        address: pred.description,
        placeId: pred.place_id,
        lat: loc?.lat,
        lng: loc?.lng,
        comuna: comunaDe(data.result?.address_components),
      })
    } catch { /* la ubicación queda solo con place_id */ }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value.address}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {suggestions.map(p => (
            <button key={p.place_id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
              onMouseDown={() => select(p)}>
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
