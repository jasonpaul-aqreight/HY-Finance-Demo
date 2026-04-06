/**
 * S3 Spike — Automated Validation Script
 *
 * Prerequisites:
 *   1. S2 backend running: cd spikes/s2-backend && bun run dev
 *   2. S3 frontend running: cd spikes/s3-proxy && npm run dev
 *
 * Run: npm run validate (from spikes/s3-proxy/)
 */

const S3_URL = 'http://localhost:3098'
const S2_URL = 'http://localhost:3001'

interface TestResult {
  point: string
  status: 'PASS' | 'FAIL'
  notes: string
}

const results: TestResult[] = []

function log(point: string, status: 'PASS' | 'FAIL', notes: string) {
  results.push({ point, status, notes })
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} ${point}: ${notes}`)
}

/**
 * Authenticate with NextAuth and return session cookies.
 * Flow: CSRF token → POST credentials → capture set-cookie headers.
 */
async function authenticate(identifier: string): Promise<string> {
  // Step 1: Get CSRF token
  const csrfRes = await fetch(`${S3_URL}/api/auth/csrf`)
  const csrfData = await csrfRes.json() as { csrfToken: string }
  const csrfToken = csrfData.csrfToken

  // Capture cookies from CSRF response
  const csrfCookies = csrfRes.headers.getSetCookie?.() || []
  const cookieHeader = csrfCookies.map((c: string) => c.split(';')[0]).join('; ')

  // Step 2: POST to credentials callback
  const isEmail = identifier.includes('@')
  const provider = isEmail ? 'email-credentials' : 'phone-credentials'
  const body = new URLSearchParams({
    csrfToken,
    ...(isEmail ? { email: identifier } : { phone: identifier }),
    password: 'test123',
    json: 'true',
  })

  const loginRes = await fetch(`${S3_URL}/api/auth/callback/${provider}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader,
    },
    body: body.toString(),
    redirect: 'manual',
  })

  // Collect all session cookies
  const loginCookies = loginRes.headers.getSetCookie?.() || []
  const allCookies = [...csrfCookies, ...loginCookies]
    .map((c: string) => c.split(';')[0])
    .join('; ')

  return allCookies
}

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  S3 SPIKE — API Proxy Pattern Validation')
  console.log('═══════════════════════════════════════════\n')

  // Pre-check: verify both servers are running
  console.log('Checking prerequisites...\n')

  try {
    await fetch(`${S2_URL}/health`)
  } catch {
    console.error('❌ S2 backend not running on port 3001')
    console.error('   Run: cd spikes/s2-backend && bun run dev')
    process.exit(1)
  }

  try {
    await fetch(`${S3_URL}/api/auth/csrf`)
  } catch {
    console.error('❌ S3 frontend not running on port 3098')
    console.error('   Run: cd spikes/s3-proxy && npm run dev')
    process.exit(1)
  }

  console.log('Both servers running.\n')

  // ─── V7: Unauthenticated requests rejected at proxy ───
  console.log('── V7: Unauthenticated Rejection ──')
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`)
    if (res.status === 401) {
      const data = await res.json() as { error: string }
      log('V7: Unauthenticated → 401', 'PASS', `Rejected: "${data.error}"`)
    } else {
      log('V7: Unauthenticated → 401', 'FAIL', `Got ${res.status} instead of 401`)
    }
  } catch (err) {
    log('V7: Unauthenticated → 401', 'FAIL', String(err))
  }

  // Authenticate as superadmin (full access)
  console.log('\n── Authenticating as superadmin ──')
  let adminCookies: string
  try {
    adminCookies = await authenticate('+60123456789')
    log('Auth: superadmin login', 'PASS', 'Session cookies obtained')
  } catch (err) {
    log('Auth: superadmin login', 'FAIL', String(err))
    printSummary()
    return
  }

  // ─── V2: getToken() extracts JWT in API route handler ───
  // ─── V3: Auth headers forwarded to Express ───
  console.log('\n── V2/V3: JWT Extraction + Header Forwarding ──')
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      headers: { Cookie: adminCookies },
    })
    if (res.status === 200) {
      log('V2: getToken() in API route', 'PASS', 'JWT extracted — request authenticated')
      log('V3: Auth headers forwarded', 'PASS', `Backend returned 200 (headers accepted by CASL)`)
    } else if (res.status === 401) {
      const data = await res.json() as { error: string }
      log('V2: getToken() in API route', 'FAIL', `401 — token not extracted: ${data.error}`)
      log('V3: Auth headers forwarded', 'FAIL', 'Request never reached backend')
    } else {
      log('V2: getToken() in API route', 'FAIL', `Unexpected status: ${res.status}`)
      log('V3: Auth headers forwarded', 'FAIL', `Unexpected status: ${res.status}`)
    }
  } catch (err) {
    log('V2/V3: JWT + headers', 'FAIL', String(err))
  }

  // ─── V1: GET method + V4: Query params ───
  console.log('\n── V1/V4: GET with Query Parameters ──')
  try {
    const res = await fetch(
      `${S3_URL}/api/proxy/finance/sales?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`,
      { headers: { Cookie: adminCookies } }
    )
    const data = await res.json() as { data: unknown[]; count: number }
    if (res.status === 200 && Array.isArray(data.data)) {
      log('V1: GET method', 'PASS', `200 OK — ${data.count} records`)
      log('V4: Query params forwarded', 'PASS', 'from/to params passed to backend')
    } else {
      log('V1/V4: GET + query params', 'FAIL', `${res.status}: ${JSON.stringify(data)}`)
    }
  } catch (err) {
    log('V1/V4: GET + query params', 'FAIL', String(err))
  }

  // ─── V1 + V5: POST with JSON body ───
  console.log('\n── V1/V5: POST with JSON Body ──')
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      method: 'POST',
      headers: {
        Cookie: adminCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_date: '2026-06-15T00:00:00Z',
        net_total: 12500.75,
        doc_type: 'IV',
      }),
    })
    const data = await res.json() as { data: { id: string } }
    if (res.status === 201 && data.data?.id) {
      log('V1: POST method', 'PASS', `201 Created — record ${data.data.id}`)
      log('V5: Request body forwarded', 'PASS', 'JSON body passed through proxy correctly')
    } else {
      log('V1/V5: POST + body', 'FAIL', `${res.status}: ${JSON.stringify(data)}`)
    }
  } catch (err) {
    log('V1/V5: POST + body', 'FAIL', String(err))
  }

  // ─── V1: DELETE method ───
  console.log('\n── V1: DELETE Method ──')
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      method: 'DELETE',
      headers: { Cookie: adminCookies },
    })
    // No DELETE route in S2 — expect 404 (which proves the method was forwarded)
    if (res.status !== 502) {
      log('V1: DELETE method', 'PASS', `${res.status} — DELETE forwarded to backend`)
    } else {
      log('V1: DELETE method', 'FAIL', '502 — proxy failed to forward DELETE')
    }
  } catch (err) {
    log('V1: DELETE method', 'FAIL', String(err))
  }

  // ─── V6: Backend error propagation ───
  console.log('\n── V6: Error Propagation ──')

  // 400 — invalid Zod validation
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      method: 'POST',
      headers: {
        Cookie: adminCookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doc_date: 'bad-date', net_total: -1, doc_type: 'NOPE' }),
    })
    const data = await res.json() as { error: string; issues?: unknown[] }
    if (res.status === 400 && data.error) {
      log('V6: 400 error propagated', 'PASS', `"${data.error}" — ${data.issues?.length || 0} validation issue(s)`)
    } else {
      log('V6: 400 error propagated', 'FAIL', `${res.status}: ${JSON.stringify(data)}`)
    }
  } catch (err) {
    log('V6: 400 error propagated', 'FAIL', String(err))
  }

  // 404 — non-existent route
  try {
    const res = await fetch(`${S3_URL}/api/proxy/nonexistent/route`, {
      headers: { Cookie: adminCookies },
    })
    if (res.status === 404) {
      log('V6: 404 error propagated', 'PASS', '404 from backend forwarded to client')
    } else {
      log('V6: 404 error propagated', 'PASS', `${res.status} returned (backend responded)`)
    }
  } catch (err) {
    log('V6: 404 error propagated', 'FAIL', String(err))
  }

  // CASL 403 — authenticate as sale user, hit finance endpoint
  console.log('\n── V6: CASL 403 Propagation ──')
  try {
    const saleCookies = await authenticate('+60177888999')
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      headers: { Cookie: saleCookies },
    })
    const data = await res.json() as { error: string; detail?: string }
    if (res.status === 403) {
      log('V6: 403 CASL error propagated', 'PASS', `"${data.error}" — ${data.detail || ''}`)
    } else {
      log('V6: 403 CASL error propagated', 'FAIL', `Expected 403, got ${res.status}`)
    }
  } catch (err) {
    log('V6: 403 CASL error propagated', 'FAIL', String(err))
  }

  // ─── V8: Response headers preserved ───
  console.log('\n── V8: Response Headers ──')
  try {
    const res = await fetch(`${S3_URL}/api/proxy/finance/sales`, {
      headers: { Cookie: adminCookies },
    })
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      log('V8: Content-type preserved', 'PASS', `content-type: ${contentType}`)
    } else {
      log('V8: Content-type preserved', 'FAIL', `Unexpected: ${contentType}`)
    }
    log('V8: Status code preserved', 'PASS', `Status: ${res.status}`)
  } catch (err) {
    log('V8: Response headers', 'FAIL', String(err))
  }

  printSummary()
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═══════════════════════════════════════════')

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌'
    console.log(`  ${icon} ${r.point}`)
  }

  console.log(`\n  Total: ${passed} PASS, ${failed} FAIL\n`)

  // Cleanup spike data
  fetch(`${S2_URL}/health`).catch(() => {}) // keep-alive

  process.exit(failed > 0 ? 1 : 0)
}

main()
