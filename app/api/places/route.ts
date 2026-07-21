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

  // Distancia en ruta entre dos place_ids
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  if (origin && destination) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=place_id:${encodeURIComponent(origin)}&destinations=place_id:${encodeURIComponent(destination)}&mode=driving&language=es&key=${KEY}`
    const res = await fetch(url)
    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === 'OK') {
      return NextResponse.json({
        distance_m: element.distance.value,
        distance_text: element.distance.text,
        duration_text: element.duration.text,
      })
    }
    return NextResponse.json({ error: 'No route found' }, { status: 404 })
  }

  // Autocomplete
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:cl&language=es&location=-33.4489,-70.6693&radius=300000&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data)
}
