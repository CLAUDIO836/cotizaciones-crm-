import { NextResponse, type NextRequest } from 'next/server'

const CRM_API = process.env.CRM_API_URL ?? 'https://transccl.cl/crm-api.php'

async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${CRM_API}?action=me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isPublic =
    pathname.startsWith('/solicitar') ||
    pathname.startsWith('/aprobar') ||
    pathname.startsWith('/firmar') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/update-password')

  const isLoginPage = pathname === '/login'

  if (isPublic) return NextResponse.next()

  const token = request.cookies.get('crm_token')?.value

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token) {
    const valid = await verifyToken(token)
    if (!valid && !isLoginPage) {
      const res = NextResponse.redirect(new URL('/login', request.url))
      res.cookies.delete('crm_token')
      return res
    }
    if (valid && isLoginPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
