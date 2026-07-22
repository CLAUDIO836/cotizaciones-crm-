import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationPDF } from '@/lib/pdf/generate'
import { TKSQuotationPDF } from '@/lib/pdf/tks-quotation'
import { NextRequest, NextResponse } from 'next/server'
import { fetchQuotation, getToken } from '@/lib/api'
import React from 'react'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = await fetchQuotation(id)
  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const items = (q.quotation_items ?? []).sort((a: {sort_order: number}, b: {sort_order: number}) => a.sort_order - b.sort_order)

  const isTKS = (q.company ?? (q as Record<string,unknown>).company_real_name ?? "").toString().includes("TKS")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfElement: any

  if (isTKS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfElement = React.createElement(TKSQuotationPDF as any, {
      data: {
        number: q.number,
        issue_date: q.issue_date,
        expiry_date: q.expiry_date,
        subtotal: q.subtotal,
        tax_pct: q.tax_pct,
        total: q.total,
        client: q.clients,
        vendedor: q.profiles,
        desde: q.desde,
        hasta: q.hasta,
        fecha_salida: q.fecha_salida,
        hora_salida: q.hora_salida,
        fecha_retorno: q.fecha_retorno,
        hora_retorno: q.hora_retorno,
        items,
      }
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfElement = React.createElement(QuotationPDF as any, {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(pdfElement as any)

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${q.number}.pdf"`,
    },
  })
}
