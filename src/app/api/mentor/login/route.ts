import { NextRequest, NextResponse } from 'next/server'
import { createMentorToken, credentialFor } from '@/lib/mentor-session'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name = typeof body.login === 'string' ? body.login.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const user = credentialFor(name, password)
  if (!user) return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000
  const session = { name, role: user.role, displayName: user.displayName, exp }
  const response = NextResponse.json({ name, role: user.role, displayName: user.displayName })
  response.cookies.set('mentor_session', createMentorToken(session), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: 7 * 24 * 60 * 60,
  })
  return response
}
