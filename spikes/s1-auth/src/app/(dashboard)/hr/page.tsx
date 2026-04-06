import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export default async function HRPage() {
  const session = await getServerSession(authOptions)

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>HR Module</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Your role <strong style={{ color: '#2563eb' }}>{session?.user.role}</strong> has HR access.
      </p>
      <p style={{ fontSize: 14, color: '#94a3b8' }}>Allowed roles: superadmin, hr, director, manager</p>
    </div>
  )
}
