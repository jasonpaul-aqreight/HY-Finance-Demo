/**
 * SPIKE S3 — CORE VALIDATION FILE
 *
 * Catch-all API proxy route: /api/proxy/[...path]
 * Forwards authenticated requests from Next.js → Express backend.
 *
 * Security boundary: extracts NextAuth JWT, rejects unauthenticated
 * requests, then forwards user identity as headers to the backend.
 *
 * Example: /api/proxy/finance/sales → http://localhost:3001/api/v1/finance/sales
 */
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxyRequest(request: NextRequest, context: RouteContext) {
  // --- V2: Extract JWT in API route handler ---
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // --- V7: Reject unauthenticated requests at proxy level ---
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized — no valid session' },
      { status: 401 }
    )
  }

  // Build backend URL from path segments
  const { path } = await context.params
  const targetPath = path.join('/')

  // --- V4: Forward query parameters ---
  const url = new URL(request.url)
  const queryString = url.search

  const backendUrl = `${BACKEND_URL}/api/v1/${targetPath}${queryString}`

  // --- V3: Forward auth headers to Express backend ---
  const headers: Record<string, string> = {
    'x-user-id': (token.backendUserId || token.sub || 'unknown') as string,
    'x-user-role': (token.role as string) || 'sale',
    'content-type': request.headers.get('content-type') || 'application/json',
  }

  if (token.departmentCode) {
    headers['x-department-code'] = token.departmentCode as string
  }

  // Forward access token for backend-to-backend auth if needed
  if (token.accessToken) {
    headers['authorization'] = `Bearer ${token.accessToken}`
  }

  // --- V5: Forward request body for POST/PUT/PATCH ---
  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  }

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    fetchOptions.body = await request.text()
  }

  try {
    const backendResponse = await fetch(backendUrl, fetchOptions)

    // --- V6 + V8: Propagate status, headers, and body ---
    const responseBody = await backendResponse.text()

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      headers: {
        'content-type': backendResponse.headers.get('content-type') || 'application/json',
      },
    })
  } catch (error) {
    // Backend unreachable — return 502 Bad Gateway
    console.error('[proxy] Backend error:', error)
    return NextResponse.json(
      { error: 'Backend unavailable', detail: String(error) },
      { status: 502 }
    )
  }
}

// --- V1: Export all HTTP methods ---
export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const DELETE = proxyRequest
export const PATCH = proxyRequest
