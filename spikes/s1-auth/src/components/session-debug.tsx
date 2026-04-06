'use client'

import { useSession, signOut } from 'next-auth/react'

/**
 * SPIKE S1 — KEY VALIDATION POINT
 *
 * useSession() in a Client Component on React 19.
 * Validates that SessionProvider context works.
 */
export function SessionDebug() {
  const { data: session, status } = useSession()

  return (
    <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <p>
        <strong>useSession() status:</strong>{' '}
        <span style={{ color: status === 'authenticated' ? 'green' : 'red' }}>
          {status}
        </span>
      </p>

      {session && (
        <>
          <p><strong>Client-side session user:</strong> {session.user.name} ({session.user.role})</p>
          <p><strong>Access token present:</strong> {session.accessToken ? 'Yes' : 'No'}</p>
        </>
      )}

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        style={{
          marginTop: 12,
          padding: '8px 16px',
          backgroundColor: '#EF4444',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Sign Out
      </button>
    </div>
  )
}
