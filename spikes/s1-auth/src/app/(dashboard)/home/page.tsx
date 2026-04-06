import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SessionDebug } from '@/components/session-debug'

/**
 * SPIKE S1 — KEY VALIDATION POINT
 *
 * getServerSession() in a Server Component on Next.js 16 + React 19.
 * This validates that server-side session retrieval works.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Home — Spike S1 Validation</h1>

      <div style={{ padding: 16, backgroundColor: '#e8f5e9', marginBottom: 24, borderRadius: 4 }}>
        <strong>getServerSession() in Server Component:</strong>{' '}
        {session ? 'PASS' : 'FAIL — session is null'}
      </div>

      {session && (
        <div style={{ marginBottom: 24 }}>
          <h2>Session Data (Server Component)</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['User ID', session.user.id],
                ['Name', session.user.name],
                ['Email', session.user.email],
                ['Phone', session.user.phone],
                ['Role', session.user.role],
                ['Permissions', session.user.permissions?.join(', ')],
                ['Employee Code', session.user.employee_code],
                ['Department Code', session.user.department_code],
                ['Access Token', session.accessToken ? `${session.accessToken.slice(0, 20)}...` : 'none'],
                ['Cognito Sub', session.cognitoSub],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{label}</td>
                  <td style={{ padding: 8 }}>{value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Multi-Module Navigation (RBAC Test)</h2>
      <p>Click each module link. proxy.ts should block based on your role:</p>
      <ul style={{ lineHeight: 2 }}>
        <li><a href="/finance">Finance Module</a> — superadmin, finance, director only</li>
        <li><a href="/hr">HR Module</a> — superadmin, hr, director, manager only</li>
        <li><a href="/sales">Sales Module</a> — superadmin, sale, operation, director only</li>
      </ul>

      <h2>Client Component Session (useSession)</h2>
      <SessionDebug />
    </div>
  )
}
