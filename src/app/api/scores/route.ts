import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessMentor, getMentorSession } from '@/lib/mentor-session'

export async function GET(request: NextRequest) {
  const session = getMentorSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const submissionId = request.nextUrl.searchParams.get('submission_id')
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })
  const { data: submission } = await db.from('submissions').select('participant_id').eq('id', submissionId).single()
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: participant } = await db.from('participants').select('mentor').eq('id', submission.participant_id).single()
  if (!canAccessMentor(session, participant?.mentor ?? null)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db.from('scores')
    .select('section, score, reasoning, strengths, weaknesses, criteria_details')
    .eq('submission_id', submissionId).eq('run_number', 1).order('section')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
