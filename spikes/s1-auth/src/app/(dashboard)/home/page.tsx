import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getModulesForRole, MODULE_CONFIGS } from '@/lib/module-permissions'
import { SessionDebug } from '@/components/session-debug'

/**
 * SPIKE S5 — Home page showing module access summary per role.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const role = session?.user.role || 'sale'
  const accessibleModules = getModulesForRole(role)

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Welcome, {session?.user.name}
      </h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>
        Spike S5 — Multi-Module Navigation + RBAC Visibility
      </p>

      {/* Module access matrix */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Module Access for role: <span style={{ color: '#2563eb' }}>{role}</span></h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Module</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Access</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Allowed Roles</th>
            </tr>
          </thead>
          <tbody>
            {MODULE_CONFIGS.map((mod) => {
              const hasAccess = accessibleModules.some((m) => m.id === mod.id)
              return (
                <tr key={mod.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                    {mod.icon} {mod.label}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      backgroundColor: hasAccess ? '#dcfce7' : '#fee2e2',
                      color: hasAccess ? '#166534' : '#991b1b',
                    }}>
                      {hasAccess ? 'ALLOWED' : 'BLOCKED'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: '#64748b' }}>
                    {mod.allowedRoles.join(', ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Session debug (client component from S1) */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Client Session (useSession)</h2>
      <SessionDebug />
    </div>
  )
}
