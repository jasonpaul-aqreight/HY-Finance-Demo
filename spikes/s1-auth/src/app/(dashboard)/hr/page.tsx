import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export default async function HRPage() {
  const session = await getServerSession(authOptions)

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>HR Module</h1>
      <p>If you can see this, your role ({session?.user.role}) has HR access.</p>
      <p>Allowed roles: superadmin, hr, director, manager</p>
      <a href="/home">Back to Home</a>
    </div>
  )
}
