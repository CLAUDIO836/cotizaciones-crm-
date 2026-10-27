import { NextRequest, NextResponse } from 'next/server'

// Polígono aproximado del Anillo Vespucio (Américo Vespucio), Santiago de Chile
// Coordenadas [lng, lat] en sentido horario
const VESPUCIO_POLYGON: [number, number][] = [
  [-70.760, -33.375], // NW: Pudahuel / Ruta 68
  [-70.710, -33.358], // N: Quilicura / Autopista Central
  [-70.678, -33.353], // N: Conchali
  [-70.640, -33.352], // N: Huechuraba
  [-70.608, -33.362], // NE: El Salto / Recoleta
  [-70.578, -33.376], // NE: Vitacura Norte
  [-70.555, -33.395], // E: Vitacura / Kennedy
  [-70.548, -33.422], // E: Las Condes
  [-70.553, -33.450], // SE: La Reina
  [-70.563, -33.470], // SE: Peñalolén Norte
  [-70.574, -33.492], // S-SE: La Florida Norte
  [-70.585, -33.516], // S: La Florida
  [-70.598, -33.538], // S: La Florida Sur
  [-70.617, -33.556], // S-SW: La Cisterna / Gran Avenida
  [-70.648, -33.563], // SW: El Bosque
  [-70.685, -33.556], // SW: Lo Espejo / San Miguel
  [-70.720, -33.543], // W-SW: Maipú Norte
  [-70.750, -33.536], // W: Maipú / Ruta 78
  [-70.773, -33.512], // W: Pudahuel Sur
  [-70.782, -33.477], // W: Pudahuel / Pajaritos
  [-70.780, -33.440], // W: Pudahuel Centro
  [-70.775, -33.400], // NW: Pudahuel Norte
  [-70.760, -33.375], // cierre
]

// Ray-casting: devuelve true si el punto está dentro del polígono
function pointInPolygon(lat: number, lng: number): boolean {
  const x = lng, y = lat
  const poly = VESPUCIO_POLYGON
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1]
    const xj = poly[j][0], yj = poly[j][1]
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat y lng requeridos' }, { status: 400 })
  }
  return NextResponse.json({ inside: pointInPolygon(lat, lng) })
}
