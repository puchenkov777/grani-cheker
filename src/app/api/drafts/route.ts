import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET — load draft
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('data, updated_at')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ data: {}, updated_at: null })
  }

  return NextResponse.json(data)
}

// POST — save draft (upsert)
export async function POST(request: NextRequest) {
  try {
    const { user_id, data: draftData } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
    }

    const { error } = await supabase
      .from('drafts')
      .upsert({
        user_id,
        data: draftData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Draft save error:', error)
      return NextResponse.json({ error: 'Ошибка сохранения черновика' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Draft error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
