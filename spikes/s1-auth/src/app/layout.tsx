import type { Metadata } from 'next'
import { SessionProviderWrapper } from '@/components/session-provider-wrapper'

export const metadata: Metadata = {
  title: 'Spike S1 — Auth Validation',
  description: 'NextAuth v4.24.13 on Next.js 16 + React 19',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* KEY VALIDATION: SessionProvider on React 19 */}
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  )
}
