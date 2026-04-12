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
    const { email, password, name, mentor } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, пароль и имя обязательны' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: name.trim(),
        mentor: mentor || null,
      })
      .select('id, email, name, mentor')
      .single()

    if (userError || !user) {
      console.error('Register error:', userError)
      return NextResponse.json({ error: 'Ошибка регистрации: ' + (userError?.message ?? 'unknown') }, { status: 500 })
    }

    // Create empty draft
    await supabase.from('drafts').insert({ user_id: user.id, data: {} })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
