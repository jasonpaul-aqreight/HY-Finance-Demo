/**
 * SPIKE S5 — Multi-Module Navigation + RBAC Visibility
 *
 * Single source of truth for module-level role access.
 * Used by both proxy.ts (route protection) and Sidebar (visibility).
 */

export type AppModule = 'finance' | 'hr' | 'sales'

export interface ModuleConfig {
  id: AppModule
  label: string
  path: string
  icon: string // emoji for spike — production would use Lucide icons
  allowedRoles: string[]
}

export const MODULE_CONFIGS: ModuleConfig[] = [
  {
    id: 'finance',
    label: 'Finance',
    path: '/finance',
    icon: '💰',
    allowedRoles: ['superadmin', 'finance', 'director'],
  },
  {
    id: 'hr',
    label: 'HR',
    path: '/hr',
    icon: '👥',
    allowedRoles: ['superadmin', 'hr', 'director', 'manager'],
  },
  {
    id: 'sales',
    label: 'Sales',
    path: '/sales',
    icon: '📊',
    allowedRoles: ['superadmin', 'sale', 'operation', 'director'],
  },
]

/**
 * Returns modules the given role can access.
 */
export function getModulesForRole(role: string): ModuleConfig[] {
  return MODULE_CONFIGS.filter((m) => m.allowedRoles.includes(role))
}

/**
 * Checks if a role can access a specific path prefix.
 * Used by proxy.ts for route protection.
 */
export function canAccessPath(role: string, pathname: string): boolean {
  const module = MODULE_CONFIGS.find((m) => pathname.startsWith(m.path))
  if (!module) return true // non-module routes are accessible
  return module.allowedRoles.includes(role)
}
