import { NextResponse } from 'next/server'

/**
 * Mock backend login endpoint — identical to S1.
 * Simulates Express backend /api/v1/auth/login response.
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { identifier, password } = body

  if (!identifier || password !== 'test123') {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }

  const isEmail = identifier.includes('@')

  const mockUsers: Record<string, { role: string; name: string; department_code?: string }> = {
    '+60123456789': { role: 'superadmin', name: 'Admin User' },
    '+60198765432': { role: 'finance', name: 'Finance User', department_code: 'FIN' },
    '+60111222333': { role: 'hr', name: 'HR User', department_code: 'HR' },
    '+60144555666': { role: 'director', name: 'Director User' },
    '+60177888999': { role: 'sale', name: 'Sales User' },
    'admin@hoiyong.com': { role: 'superadmin', name: 'Admin User' },
    'finance@hoiyong.com': { role: 'finance', name: 'Finance User', department_code: 'FIN' },
  }

  const userData = mockUsers[identifier] || { role: 'sale', name: 'Test User' }

  return NextResponse.json({
    user: {
      id: 'usr_mock_' + Math.random().toString(36).slice(2, 10),
      email: isEmail ? identifier : `${identifier.replace('+', '')}@mock.hoiyong.com`,
      name: userData.name,
      phone: isEmail ? '+60100000000' : identifier,
      role: userData.role,
      cognito_sub: 'cognito-mock-sub-' + Math.random().toString(36).slice(2, 10),
      employee_code: 'EMP001',
      department_code: userData.department_code || null,
    },
    access_token: 'mock-access-token-' + Date.now(),
    refresh_token: 'mock-refresh-token-' + Date.now(),
    token_type: 'Bearer',
    expires_in: 3600,
  })
}
