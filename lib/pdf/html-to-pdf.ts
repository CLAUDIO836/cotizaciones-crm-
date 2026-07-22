import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

const CHROMIUM_URL = process.env.CHROMIUM_URL ?? ''

async function inlineImages(html: string, origin: string): Promise<string> {
  // Extraer todas las URLs de imágenes absolutas
  const imgRegex = /src="(https?:\/\/[^"]+\.(png|jpg|jpeg|gif|svg|webp))"/gi
  const matches = [...html.matchAll(imgRegex)]
  const urls = [...new Set(matches.map(m => m[1]))]

  const replacements = await Promise.all(
    urls.map(async (imgUrl) => {
      try {
        const res = await fetch(imgUrl, { cache: 'no-store' })
        if (!res.ok) return { url: imgUrl, data: null }
        const buf = await res.arrayBuffer()
        const mime = res.headers.get('content-type') ?? 'image/png'
        const b64 = Buffer.from(buf).toString('base64')
        return { url: imgUrl, data: `data:${mime};base64,${b64}` }
      } catch {
        return { url: imgUrl, data: null }
      }
    })
  )

  for (const { url: imgUrl, data } of replacements) {
    if (data) {
      html = html.replaceAll(`src="${imgUrl}"`, `src="${data}"`)
    }
  }

  // También convertir rutas relativas a absolutas por si queda alguna
  html = html.replace(/(src|href)="\/((?!\/)[^"]+)"/g, `$1="${origin}/$2"`)
  return html
}

export async function htmlToPdf(url: string, cookieToken?: string): Promise<Buffer> {
  const fetchHeaders: Record<string, string> = {}
  if (cookieToken) fetchHeaders['Cookie'] = `crm_token=${cookieToken}`

  const htmlRes = await fetch(url, { headers: fetchHeaders, cache: 'no-store' })
  if (!htmlRes.ok) throw new Error(`HTML fetch ${htmlRes.status} → ${url.split('?')[0]}`)
  let html = await htmlRes.text()

  // Primero reemplazar rutas relativas con absolutas
  const origin = new URL(url).origin
  html = html.replace(/(src|href)="\/((?!\/)[^"]+)"/g, `$1="${origin}/$2"`)

  // Incrustar imágenes como base64 para que funcionen en data: URL sin requests externos
  html = await inlineImages(html, origin)

  const executablePath = CHROMIUM_URL
    ? await chromium.executablePath(CHROMIUM_URL)
    : await chromium.executablePath()

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()

    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await page.evaluate(() => {
      const btns = document.querySelectorAll('.no-print, [data-no-print]')
      btns.forEach(el => ((el as HTMLElement).style.display = 'none'))
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
