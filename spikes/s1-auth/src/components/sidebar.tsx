'use client'

/**
 * SPIKE S5 — Sidebar with role-based module visibility.
 *
 * Validates:
 * 1. useSession() provides role in client component
 * 2. Sidebar only renders modules the role can access
 * 3. Active module highlighting via usePathname()
 * 4. Module switching feels natural (no full page reload)
 */

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { getModulesForRole, type ModuleConfig } from '@/lib/module-permissions'

export function Sidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading') {
    return (
      <aside style={sidebarStyle}>
        <div style={{ padding: 16, color: '#94a3b8' }}>Loading...</div>
      </aside>
    )
  }

  if (!session) return null

  const role = session.user.role || 'sale'
  const modules = getModulesForRole(role)

  return (
    <aside style={sidebarStyle}>
      {/* App header */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Hoi-Yong</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Platform v2</div>
      </div>

      {/* Home link */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        <SidebarLink
          href="/home"
          label="Home"
          icon="🏠"
          active={pathname === '/home'}
        />

        {/* Module separator */}
        <div style={{ padding: '12px 12px 6px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Modules
        </div>

        {/* Role-filtered modules */}
        {modules.map((mod) => (
          <SidebarLink
            key={mod.id}
            href={mod.path}
            label={mod.label}
            icon={mod.icon}
            active={pathname.startsWith(mod.path)}
          />
        ))}

        {modules.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 13, color: '#64748b' }}>
            No modules assigned
          </div>
        )}
      </nav>

      {/* User info + sign out */}
      <div style={{ padding: 16, borderTop: '1px solid #334155' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
          {session.user.name}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          Role: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{role}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: '#f87171',
            border: '1px solid #7f1d1d',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}

function SidebarLink({ href, label, icon, active }: {
  href: string
  label: string
  icon: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 6,
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? '#fff' : '#cbd5e1',
        backgroundColor: active ? '#1e40af' : 'transparent',
        textDecoration: 'none',
        marginBottom: 2,
        transition: 'background-color 0.15s ease',
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </Link>
  )
}

const sidebarStyle: React.CSSProperties = {
  width: 240,
  minHeight: '100vh',
  backgroundColor: '#0f172a',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}
