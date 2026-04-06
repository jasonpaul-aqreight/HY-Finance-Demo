import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export default async function FinancePage() {
  const session = await getServerSession(authOptions)

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Finance Module</h1>
      <p>If you can see this, your role ({session?.user.role}) has Finance access.</p>
      <p>Allowed roles: superadmin, finance, director</p>
      <a href="/home">Back to Home</a>
    </div>
  )
}
