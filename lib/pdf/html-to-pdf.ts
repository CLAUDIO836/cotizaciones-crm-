import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// URL del Chromium remoto que usa @sparticuz/chromium-min en Vercel
const CHROMIUM_URL = process.env.CHROMIUM_URL ?? ''

export async function htmlToPdf(url: string): Promise<Buffer> {
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
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

    // Ocultar botones de impresión que no deben aparecer en el PDF
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
