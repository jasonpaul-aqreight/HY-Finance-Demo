'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 400, margin: '100px auto' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}

/**
 * SPIKE S1 — Login form validating credentials provider flow.
 * Mirrors production: auto-detect email vs phone, call signIn().
 */
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/home'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Auto-detect: email contains @, otherwise treat as phone
      const isEmail = identifier.includes('@')
      const provider = isEmail ? 'email-credentials' : 'phone-credentials'

      // Format phone: 0123456789 → +60123456789
      const formattedIdentifier = !isEmail && identifier.startsWith('0')
        ? `+60${identifier.slice(1)}`
        : identifier

      const result = await signIn(provider, {
        redirect: false,
        ...(isEmail
          ? { email: formattedIdentifier }
          : { phone: formattedIdentifier }),
        password,
      })

      if (result?.error) {
        setError('Invalid credentials. Try password: test123')
      } else if (result?.ok) {
        router.push(redirect)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h1>Spike S1 — Login</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        NextAuth v4.24.13 + Next.js 16 + React 19
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="identifier" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Phone or Email
          </label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="+60123456789 or admin@hoiyong.com"
            style={{ width: '100%', padding: 8, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="test123"
            style={{ width: '100%', padding: 8, fontSize: 16, boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <p style={{ color: 'red', marginBottom: 16 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            fontSize: 16,
            fontWeight: 600,
            backgroundColor: '#1F4E79',
            color: 'white',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f5f5f5', fontSize: 13 }}>
        <strong>Test accounts (password: test123)</strong>
        <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
          <li>+60123456789 — superadmin</li>
          <li>+60198765432 — finance</li>
          <li>+60111222333 — hr</li>
          <li>+60144555666 — director</li>
          <li>+60177888999 — sale</li>
          <li>admin@hoiyong.com — superadmin</li>
        </ul>
      </div>
    </div>
  )
}
