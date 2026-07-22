import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_MAPS_API_KEY!

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')
  const placeId = searchParams.get('place_id')

  if (!KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  // Detalle de un lugar (lat/lng)
  if (placeId) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address&key=${KEY}&language=es`
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  }

  // Distancia en ruta entre dos place_ids (via OSRM — no requiere Distance Matrix API)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  if (origin && destination) {
    // Obtener lat/lng de cada place_id usando Place Details
    async function getLatLng(placeId: string) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${KEY}`)
      const d = await r.json()
      return d?.result?.geometry?.location as { lat: number; lng: number } | undefined
    }
    const [oLoc, dLoc] = await Promise.all([getLatLng(origin), getLatLng(destination)])
    if (!oLoc || !dLoc) return NextResponse.json({ error: 'No coordinates' }, { status: 404 })

    // OSRM para distancia de conducción (gratuito, sin API key)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLoc.lng},${oLoc.lat};${dLoc.lng},${dLoc.lat}?overview=false`
    const osrmRes = await fetch(osrmUrl)
    const osrmData = await osrmRes.json()
    const route = osrmData?.routes?.[0]
    if (!route) return NextResponse.json({ error: 'No route found' }, { status: 404 })

    const distanceM = Math.round(route.distance)
    const durationSec = Math.round(route.duration)
    const hours = Math.floor(durationSec / 3600)
    const mins = Math.floor((durationSec % 3600) / 60)
    const durationText = hours > 0 ? `${hours} h ${mins} min` : `${mins} min`

    return NextResponse.json({
      distance_m: distanceM,
      distance_text: `${Math.round(distanceM / 1000)} km`,
      duration_text: durationText,
    })
  }

  // Autocomplete
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:cl&language=es&location=-33.4489,-70.6693&radius=300000&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data)
}
