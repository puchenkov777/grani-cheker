import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET — list cases for a user
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cases')
    .select('id, title, task_text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cases: data ?? [] })
}

// POST — create a new case
export async function POST(request: NextRequest) {
  try {
    const { user_id, title, task_text } = await request.json()

    if (!user_id || !title?.trim() || !task_text?.trim()) {
      return NextResponse.json({ error: 'user_id, название и текст задания обязательны' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('cases')
      .insert({
        user_id,
        title: title.trim(),
        task_text: task_text.trim(),
      })
      .select('id, title, task_text, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, case: data })
  } catch (error) {
    console.error('Cases error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// DELETE — remove a case
export async function DELETE(request: NextRequest) {
  try {
    const { case_id, user_id } = await request.json()

    if (!case_id || !user_id) {
      return NextResponse.json({ error: 'case_id и user_id обязательны' }, { status: 400 })
    }

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', case_id)
      .eq('user_id', user_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cases delete error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
