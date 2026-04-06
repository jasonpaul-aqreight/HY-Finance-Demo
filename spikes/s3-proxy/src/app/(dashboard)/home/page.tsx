import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ProxyTestPanel } from '@/components/proxy-test-panel'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Spike S3 — API Proxy Pattern</h1>
      <p style={{ color: '#666' }}>
        Logged in as <strong>{session?.user.name}</strong> (role: {session?.user.role})
      </p>

      <div style={{ marginTop: 24 }}>
        <h2>Proxy Validation Tests</h2>
        <p>Each test calls /api/proxy/... which forwards to the Express backend on port 3001.</p>
        <ProxyTestPanel userRole={session?.user.role || 'unknown'} />
      </div>

      <div style={{ marginTop: 32, padding: 16, backgroundColor: '#f5f5f5', fontSize: 13 }}>
        <strong>Prerequisites:</strong> S2 backend must be running on port 3001
        <br />
        <code>cd spikes/s2-backend && bun run dev</code>
      </div>
    </div>
  )
}
