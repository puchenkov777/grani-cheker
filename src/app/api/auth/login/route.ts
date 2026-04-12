import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'grani_salt_2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, mentor')
      .eq('email', email.toLowerCase().trim())
      .eq('password_hash', passwordHash)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
