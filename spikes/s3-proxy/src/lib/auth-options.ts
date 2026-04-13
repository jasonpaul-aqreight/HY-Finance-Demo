import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3098/api/mock'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'spike-s3-secret-for-testing-only',
  providers: [
    CredentialsProvider({
      id: 'phone-credentials',
      name: 'Phone Number',
      credentials: {
        phone: { label: 'Phone Number', type: 'tel', placeholder: '+60123456789' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null

        try {
          const res = await fetch(`${backendUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: credentials.phone,
              password: credentials.password,
            }),
          })

          const data = await res.json()

          if (res.ok && data.user && data.access_token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              phone: data.user.phone,
              role: data.user.role,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              tokenType: data.token_type || 'Bearer',
              expiresIn: data.expires_in,
              cognitoSub: data.user.cognito_sub,
              employee_code: data.user.employee_code || null,
              department_code: data.user.department_code || null,
            }
          }

          return null
        } catch (error) {
          console.error('Phone auth error:', error)
          return null
        }
      },
    }),

    CredentialsProvider({
      id: 'email-credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const res = await fetch(`${backendUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: credentials.email,
              password: credentials.password,
            }),
          })

          const data = await res.json()

          if (res.ok && data.user && data.access_token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              phone: data.user.phone,
              role: data.user.role,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              tokenType: data.token_type || 'Bearer',
              expiresIn: data.expires_in,
              cognitoSub: data.user.cognito_sub,
              employee_code: data.user.employee_code || null,
              department_code: data.user.department_code || null,
            }
          }

          return null
        } catch (error) {
          console.error('Email auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role || 'sale'
        token.phone = user.phone
        token.permissions = user.permissions || ['read']
        token.cognitoSub = user.cognitoSub
        token.backendUserId = user.id
        token.employeeCode = user.employee_code || undefined
        token.departmentCode = user.department_code || undefined
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.tokenType = user.tokenType || 'Bearer'
        token.expiresIn = user.expiresIn
      }

      if (trigger === 'update' && session) {
        const s = session as Record<string, unknown>
        if (s.accessToken) token.accessToken = s.accessToken as string
        if (s.refreshToken) token.refreshToken = s.refreshToken as string
      }

      return token
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = (token.backendUserId || token.sub) as string
      }
      session.user.name = token.name as string
      session.user.email = token.email as string

      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.tokenType = (token.tokenType as string) || 'Bearer'
      session.expiresIn = token.expiresIn as number
      session.cognitoSub = (token.cognitoSub as string) || undefined

      session.user.role = (token.role as string) || 'sale'
      session.user.phone = (token.phone as string) || ''
      session.user.permissions = (token.permissions as string[]) || ['read']
      session.user.employee_code = (token.employeeCode as string) || undefined
      session.user.department_code = (token.departmentCode as string) || undefined

      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  debug: true,
}
