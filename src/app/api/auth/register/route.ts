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
    const { telegram, password, name, mentor } = await request.json()

    if (!telegram || !password || !name) {
      return NextResponse.json({ error: 'Telegram, пароль и имя обязательны' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
    }

    const normalizedTelegram = normalizeTelegram(telegram)

    // Check if user already exists
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('telegram', normalizedTelegram)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким Telegram уже существует' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const { data: user, error: userError } = await db
      .from('users')
      .insert({
        telegram: normalizedTelegram,
        password_hash: passwordHash,
        name: name.trim(),
        mentor: mentor || null,
      })
      .select('id, telegram, name, mentor')
      .single()

    if (userError || !user) {
      console.error('Register error:', userError)
      return NextResponse.json({ error: 'Ошибка регистрации: ' + (userError?.message ?? 'unknown') }, { status: 500 })
    }

    // Create empty draft
    await db.from('drafts').insert({ user_id: user.id, data: {} })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
