import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET — fetch submission data for editing
export async function GET(request: NextRequest) {
  const submissionId = request.nextUrl.searchParams.get('id')
  const userId = request.nextUrl.searchParams.get('user_id')

  if (!submissionId || !userId) {
    return NextResponse.json({ error: 'id и user_id обязательны' }, { status: 400 })
  }

  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*, participants(name, mentor)')
    .eq('id', submissionId)
    .eq('user_id', userId)
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'Работа не найдена' }, { status: 404 })
  }

  return NextResponse.json({ submission })
}
