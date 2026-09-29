import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
  }

  const { data: user, error } = await db
    .from('users')
    .select('id, telegram, name, mentor, created_at')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }

  // Get user submissions
  const { data: submissions } = await db
    .from('submissions')
    .select('id, case_title, status, created_at, total_scores(total, grade)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    user,
    submissions: submissions ?? [],
  })
}
