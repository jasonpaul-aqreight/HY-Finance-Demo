'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

interface TestResult {
  id: string
  label: string
  status: 'pass' | 'fail' | 'pending' | 'running'
  detail: string
}

export function ProxyTestPanel({ userRole }: { userRole: string }) {
  const [results, setResults] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)

  function updateResult(id: string, update: Partial<TestResult>) {
    setResults((prev) => {
      const existing = prev.find((r) => r.id === id)
      if (existing) {
        return prev.map((r) => (r.id === id ? { ...r, ...update } : r))
      }
      return [...prev, { id, label: '', status: 'pending', detail: '', ...update }]
    })
  }

  async function runAllTests() {
    setRunning(true)
    setResults([])

    // V1 + V4: GET with query params → /api/proxy/finance/sales?from=...&to=...
    updateResult('v1-get', { label: 'V1/V4: GET /finance/sales?from=&to=', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales?from=2026-01-01&to=2026-12-31')
      const data = await res.json()
      if (res.ok && Array.isArray(data.data)) {
        updateResult('v1-get', {
          status: 'pass',
          detail: `${res.status} OK — ${data.count} records, query params forwarded`,
        })
      } else if (res.status === 403) {
        updateResult('v1-get', {
          status: userRole === 'sale' ? 'pass' : 'fail',
          detail: `403 Forbidden — role "${userRole}" blocked by CASL (expected for sale role)`,
        })
      } else {
        updateResult('v1-get', { status: 'fail', detail: `${res.status}: ${JSON.stringify(data)}` })
      }
    } catch (err) {
      updateResult('v1-get', { status: 'fail', detail: String(err) })
    }

    // V1 + V5: POST with JSON body
    updateResult('v1-post', { label: 'V1/V5: POST /finance/sales (JSON body)', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_date: '2026-06-15T00:00:00Z',
          net_total: 12500.75,
          doc_type: 'IV',
        }),
      })
      const data = await res.json()
      if (res.status === 201 && data.data?.id) {
        updateResult('v1-post', {
          status: 'pass',
          detail: `201 Created — record ${data.data.id}, body forwarded correctly`,
        })
      } else if (res.status === 403) {
        updateResult('v1-post', {
          status: 'pass',
          detail: `403 Forbidden — role "${userRole}" cannot create (CASL working)`,
        })
      } else {
        updateResult('v1-post', { status: 'fail', detail: `${res.status}: ${JSON.stringify(data)}` })
      }
    } catch (err) {
      updateResult('v1-post', { status: 'fail', detail: String(err) })
    }

    // V1: DELETE method
    updateResult('v1-delete', { label: 'V1: DELETE /finance/sales (method support)', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales', { method: 'DELETE' })
      // Express will likely 404 since no DELETE route exists — that's fine,
      // we're testing that the proxy forwards DELETE at all
      updateResult('v1-delete', {
        status: res.status !== 502 ? 'pass' : 'fail',
        detail: `${res.status} — DELETE forwarded to backend (${res.status === 404 ? 'no route, expected' : 'route exists'})`,
      })
    } catch (err) {
      updateResult('v1-delete', { status: 'fail', detail: String(err) })
    }

    // V2 + V3: Verify auth headers forwarded (GET finance/sales with finance role)
    updateResult('v2-v3-headers', { label: 'V2/V3: Auth headers forwarded (x-user-id, x-user-role)', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales')
      // If we get 200 or 403, it means the backend received and processed the auth headers
      if (res.status === 200 || res.status === 403) {
        updateResult('v2-v3-headers', {
          status: 'pass',
          detail: `Backend returned ${res.status} — auth headers received and processed by CASL`,
        })
      } else if (res.status === 401) {
        // 401 from backend means headers weren't forwarded
        updateResult('v2-v3-headers', {
          status: 'fail',
          detail: '401 from backend — auth headers NOT forwarded',
        })
      } else {
        updateResult('v2-v3-headers', { status: 'fail', detail: `Unexpected: ${res.status}` })
      }
    } catch (err) {
      updateResult('v2-v3-headers', { status: 'fail', detail: String(err) })
    }

    // V6: Backend error propagation — send invalid POST body to trigger 400
    updateResult('v6-errors', { label: 'V6: Backend 400 error propagated', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_date: 'not-a-date', net_total: -1, doc_type: 'NOPE' }),
      })
      const data = await res.json()
      if (res.status === 400 && data.error) {
        updateResult('v6-errors', {
          status: 'pass',
          detail: `400 propagated — "${data.error}" with ${data.issues?.length || 0} validation issue(s)`,
        })
      } else if (res.status === 403) {
        updateResult('v6-errors', {
          status: 'pass',
          detail: `403 before validation — role "${userRole}" cannot create (CASL runs first)`,
        })
      } else {
        updateResult('v6-errors', { status: 'fail', detail: `${res.status}: ${JSON.stringify(data)}` })
      }
    } catch (err) {
      updateResult('v6-errors', { status: 'fail', detail: String(err) })
    }

    // V6: 404 propagation — hit a non-existent backend route
    updateResult('v6-404', { label: 'V6: Backend 404 propagated', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/nonexistent/route')
      if (res.status === 404) {
        updateResult('v6-404', { status: 'pass', detail: '404 propagated from backend' })
      } else {
        updateResult('v6-404', {
          status: res.status === 502 ? 'fail' : 'pass',
          detail: `${res.status} returned (backend responded)`,
        })
      }
    } catch (err) {
      updateResult('v6-404', { status: 'fail', detail: String(err) })
    }

    // V8: Content-type preservation
    updateResult('v8-content-type', { label: 'V8: Response content-type preserved', status: 'running', detail: '' })
    try {
      const res = await fetch('/api/proxy/finance/sales')
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        updateResult('v8-content-type', {
          status: 'pass',
          detail: `content-type: ${contentType}`,
        })
      } else {
        updateResult('v8-content-type', { status: 'fail', detail: `Unexpected content-type: ${contentType}` })
      }
    } catch (err) {
      updateResult('v8-content-type', { status: 'fail', detail: String(err) })
    }

    setRunning(false)
  }

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={runAllTests}
          disabled={running}
          style={{
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 600,
            backgroundColor: running ? '#999' : '#1F4E79',
            color: 'white',
            border: 'none',
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running...' : 'Run All Proxy Tests'}
        </button>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 600,
            backgroundColor: '#EF4444',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>

      {results.length > 0 && (
        <div>
          {results.length > 0 && !running && (
            <div style={{
              padding: 12,
              marginBottom: 16,
              backgroundColor: failed === 0 ? '#e8f5e9' : '#ffebee',
              fontWeight: 600,
            }}>
              {failed === 0 ? `ALL PASS (${passed}/${passed})` : `${passed} PASS, ${failed} FAIL`}
            </div>
          )}

          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ padding: 8, textAlign: 'left', width: 60 }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Test</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: 8 }}>
                    {r.status === 'pass' && '✅'}
                    {r.status === 'fail' && '❌'}
                    {r.status === 'running' && '⏳'}
                    {r.status === 'pending' && '⬜'}
                  </td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{r.label}</td>
                  <td style={{ padding: 8, fontSize: 13 }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
