import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const publicRoutes = ['/login']

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next()
  }

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/home' : '/login', request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
