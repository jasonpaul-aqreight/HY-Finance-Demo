import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    refreshToken?: string
    tokenType?: string
    expiresIn?: number
    cognitoSub?: string
    user: {
      id: string
      email: string
      name: string
      image?: string
      phone?: string
      role?: string
      permissions?: string[]
      employee_code?: string
      department_code?: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    image?: string
    phone?: string
    role?: string
    permissions?: string[]
    accessToken?: string
    refreshToken?: string
    tokenType?: string
    expiresIn?: number
    cognitoSub?: string
    employee_code?: string
    department_code?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    tokenType?: string
    expiresIn?: number
    role?: string
    phone?: string
    permissions?: string[]
    cognitoSub?: string
    backendUserId?: string
    employeeCode?: string
    departmentCode?: string
  }
}
