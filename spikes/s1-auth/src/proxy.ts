/**
 * SPIKE S1 — KEY VALIDATION POINT
 *
 * Next.js 16 renamed middleware.ts → proxy.ts
 * This file validates that NextAuth v4's getToken() works
 * inside the new proxy.ts context.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const publicRoutes = ['/login']

// Module-level route access control (mirrors production RBAC)
const FINANCE_ALLOWED_ROLES = ['superadmin', 'finance', 'director']
const HR_ALLOWED_ROLES = ['superadmin', 'hr', 'director', 'manager']
const SALES_ALLOWED_ROLES = ['superadmin', 'sale', 'operation', 'director']

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

  // Role-based module access (multi-module validation)
  if (token) {
    const userRole = (token.role as string) || ''

    if (pathname.startsWith('/finance') && !FINANCE_ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    if (pathname.startsWith('/hr') && !HR_ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    if (pathname.startsWith('/sales') && !SALES_ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
