import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'grani_salt_2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizeTelegram(raw: string): string {
  let t = raw.trim()
  t = t.replace(/^https?:\/\/t\.me\//i, '')
  t = t.replace(/^@/, '')
  return t.toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    const { telegram, password } = await request.json()

    if (!telegram || !password) {
      return NextResponse.json({ error: 'Telegram и пароль обязательны' }, { status: 400 })
    }

    const normalizedTelegram = normalizeTelegram(telegram)
    const passwordHash = await hashPassword(password)

    const { data: user, error: userError } = await db
      .from('users')
      .select('id, telegram, name, mentor')
      .eq('telegram', normalizedTelegram)
      .eq('password_hash', passwordHash)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Неверный Telegram или пароль' }, { status: 401 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
