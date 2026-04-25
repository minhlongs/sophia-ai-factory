import type { NextRequest } from 'next/server'

export const PUBLIC_FILE_EXTENSIONS = /\.(.*)$/

export function isInternalOrStatic(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    PUBLIC_FILE_EXTENSIONS.test(pathname)
  )
}

export function pathnameWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|vi)(\/|$)/, '/')
}

export function isAdminAuthorized(request: NextRequest): boolean {
  const basicAuth = request.headers.get('authorization')
  if (!basicAuth) return false
  try {
    const authValue = basicAuth.split(' ')[1]
    const [user, pwd] = atob(authValue).split(':')
    const validUser = process.env.ADMIN_USER
    const validPass = process.env.ADMIN_PASS
    if (!validUser || !validPass) return false
    return user === validUser && pwd === validPass
  } catch {
    return false
  }
}
