import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export type MentorSession = { name: string; role: 'mentor' | 'admin'; displayName: string; exp: number }
type MentorUser = Omit<MentorSession, 'name' | 'exp'> & { password: string }

export function credentialFor(name: string, password: string): MentorUser | null {
  const configured = process.env.MENTOR_AUTH_USERS
  const users = configured ? JSON.parse(configured) as Record<string, MentorUser> : {}
  const user = users[name]
  if (!user) return null
  const expected = createHmac('sha256', 'mentor-password').update(user.password).digest()
  const provided = createHmac('sha256', 'mentor-password').update(password).digest()
  return timingSafeEqual(expected, provided) ? user : null
}

function sign(payload: string) {
  const secret = process.env.MENTOR_SESSION_SECRET
  if (!secret) throw new Error('MENTOR_SESSION_SECRET is missing')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createMentorToken(session: MentorSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function getMentorSession(request: NextRequest): MentorSession | null {
  const value = request.cookies.get('mentor_session')?.value
  if (!value) return null
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as MentorSession
    if (!session.exp || session.exp < Date.now() || !['mentor', 'admin'].includes(session.role)) return null
    return session
  } catch { return null }
}

export function canAccessMentor(session: MentorSession, mentor: string | null) {
  return session.role === 'admin' || mentor === session.displayName || mentor === session.name
}

export function checkToken(submissionId: string) {
  return sign(`check:${submissionId}`)
}

export function verifyCheckToken(submissionId: string, token: string | null) {
  const expected = checkToken(submissionId)
  return !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
