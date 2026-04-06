'use client'

import { SessionProvider } from 'next-auth/react'

/**
 * SPIKE S1 — KEY VALIDATION POINT
 *
 * SessionProvider must be a Client Component.
 * This wrapper validates that next-auth v4.24.13's
 * SessionProvider renders without crash on React 19.
 */
export function SessionProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProvider>{children}</SessionProvider>
}
