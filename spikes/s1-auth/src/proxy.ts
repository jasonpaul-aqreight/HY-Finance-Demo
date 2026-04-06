/**
 * SPIKE S1+S5 — Route protection via proxy.ts
 *
 * Next.js 16 renamed middleware.ts → proxy.ts
 * Now uses shared module-permissions for single source of truth.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { canAccessPath } from '@/lib/module-permissions'

const publicRoutes = ['/login']

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip API routes, static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next()
  }

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // Get NextAuth JWT token from cookie
  // Must pass secret explicitly — proxy.ts runs in Node.js runtime
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  console.log(`[proxy.ts] path=${pathname} | token exists=${!!token} | role=${token?.role || 'none'}`)

  // Unauthenticated → redirect to login
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated → redirect away from login
  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Root → redirect based on auth state
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/home' : '/login', request.url)
    )
  }

  // Role-based module access using shared permission map
  if (token) {
    const userRole = (token.role as string) || ''
    if (!canAccessPath(userRole, pathname)) {
      console.log(`[proxy.ts] BLOCKED: role=${userRole} path=${pathname}`)
      return NextResponse.redirect(new URL('/home', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
