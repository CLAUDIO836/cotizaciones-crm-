import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationPDF } from '@/lib/pdf/generate'
import { TKSQuotationPDF } from '@/lib/pdf/tks-quotation'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/api'
import React from 'react'

const CRM_API_STG = (process.env.CRM_API_STG_URL ?? 'https://www.transccl.cl/crm-api-stg.php').replace('://transccl.cl', '://www.transccl.cl')
const E2E_TOKEN = process.env.E2E_TEST_TOKEN ?? ''

async function fetchStgQuotation(id: string, session: { id: string; role?: string | null }) {
  const res = await fetch(`${CRM_API_STG}?action=quotations_get&id=${encodeURIComponent(id)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-token': E2E_TOKEN,
      'x-user-id': session.id,
      'x-user-role': session.role ?? '',
    },
    cache: 'no-store',
  })
  const data = await res.json()
  return data.data ?? null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  const q = await fetchStgQuotation(id, session)
  if (!q) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const items = (q.quotation_items ?? []).sort((a: {sort_order: number}, b: {sort_order: number}) => a.sort_order - b.sort_order)

  const isTKS = (q.company ?? (q as unknown as Record<string,unknown>).company_real_name ?? "").toString().includes("TKS")

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
      'Content-Disposition': `inline; filename="${q.number}-stg.pdf"`,
    },
  })
}
