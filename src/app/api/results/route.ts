import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Fetch all submissions with participant and total_scores data
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*, participants(*), total_scores(*)')
    .order('created_at', { ascending: false })

  if (subError) {
    return NextResponse.json(
      { error: 'Failed to fetch submissions', details: subError.message },
      { status: 500 }
    )
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Fetch all run_number=1 scores for these submissions
  const submissionIds = submissions.map((s) => s.id)

  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('*')
    .in('submission_id', submissionIds)
    .eq('run_number', 1)

  if (scoresError) {
    return NextResponse.json(
      { error: 'Failed to fetch scores', details: scoresError.message },
      { status: 500 }
    )
  }

  // Group scores by submission_id
  const scoresMap: Record<string, Record<string, number>> = {}
  if (scores) {
    for (const score of scores) {
      if (!scoresMap[score.submission_id]) {
        scoresMap[score.submission_id] = {}
      }
      scoresMap[score.submission_id][score.section] = score.score
    }
  }

  // Build response
  const data = submissions.map((sub) => ({
    id: sub.id,
    case_title: sub.case_title,
    status: sub.status,
    created_at: sub.created_at,
    participant_name: sub.participants?.name ?? null,
    participant_email: sub.participants?.email ?? null,
    team_name: sub.participants?.team_name ?? null,
    total: sub.total_scores?.total ?? null,
    grade: sub.total_scores?.grade ?? null,
    needs_review: sub.total_scores?.needs_review ?? false,
    scores: scoresMap[sub.id] ?? {},
  }))

  return NextResponse.json({ data })
}
