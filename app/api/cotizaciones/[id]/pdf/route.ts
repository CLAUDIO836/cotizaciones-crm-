import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationPDF } from '@/lib/pdf/generate'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: q } = await supabase
    .from('quotations')
    .select(`
      *,
      clients(name, rut, email, address),
      profiles(name),
      quotation_items(description, quantity, unit_price, subtotal, sort_order)
    `)
    .eq('id', id)
    .single()

  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const items = (q.quotation_items ?? []).sort((a: {sort_order: number}, b: {sort_order: number}) => a.sort_order - b.sort_order)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfElement = React.createElement(QuotationPDF as any, {
    data: {
      number: q.number,
      status: q.status,
      issue_date: q.issue_date,
      expiry_date: q.expiry_date,
      subtotal: q.subtotal,
      tax_pct: q.tax_pct,
      total: q.total,
      notes: q.notes,
      terms: q.terms,
      client: q.clients,
      vendedor: q.profiles,
      items,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(pdfElement as any)

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${q.number}.pdf"`,
    },
  })
}
