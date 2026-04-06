import { Sidebar } from '@/components/sidebar'

/**
 * SPIKE S5 — Dashboard layout with persistent sidebar.
 *
 * Validates: sidebar persists across module navigation
 * without full page reload (Next.js shared layout pattern).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </main>
    </div>
  )
}
