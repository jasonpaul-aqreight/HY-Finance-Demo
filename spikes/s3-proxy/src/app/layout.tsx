import type { Metadata } from 'next'
import { SessionProviderWrapper } from '@/components/session-provider-wrapper'

export const metadata: Metadata = {
  title: 'Spike S3 — API Proxy Pattern',
  description: 'Catch-all proxy route: Next.js → Express backend',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  )
}
