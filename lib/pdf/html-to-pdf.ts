import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// URL del Chromium remoto que usa @sparticuz/chromium-min en Vercel
const CHROMIUM_URL = process.env.CHROMIUM_URL ?? ''

export async function htmlToPdf(url: string, cookieToken?: string): Promise<Buffer> {
  // Fetch HTML server-side (evita problemas de auth en Puppeteer serverless)
  const fetchHeaders: Record<string, string> = {}
  if (cookieToken) fetchHeaders['Cookie'] = `crm_token=${cookieToken}`

  const htmlRes = await fetch(url, { headers: fetchHeaders, cache: 'no-store' })
  if (!htmlRes.ok) throw new Error(`HTML fetch ${htmlRes.status} → ${url.split('?')[0]}`)
  let html = await htmlRes.text()

  // Reemplazar rutas relativas con absolutas para que las imágenes carguen desde data: URL
  const origin = new URL(url).origin
  html = html.replace(/(src|href)="\/((?!\/)[^"]+)"/g, `$1="${origin}/$2"`)

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

    // Navegar a data: URL evita errores de status HTTP en la navegación principal
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })

    // Ocultar botones de impresión
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
