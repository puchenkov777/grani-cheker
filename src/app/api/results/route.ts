/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessMentor, getMentorSession } from '@/lib/mentor-session'

export async function GET(request: NextRequest) {
  const session = getMentorSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Fetch all submissions with participant and total_scores data
  const { data: submissions, error: subError } = await db
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
  const submissionIds = submissions.map((s: { id: string }) => s.id)

  const { data: scores, error: scoresError } = await db
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
  const data = submissions.filter((sub: Record<string, any>) =>
    canAccessMentor(session, sub.participants?.mentor ?? null)
  ).map((sub: Record<string, any>) => ({
    id: sub.id,
    case_title: sub.case_title,
    status: sub.status,
    created_at: sub.created_at,
    participant_name: sub.participants?.name ?? null,
    participant_email: sub.participants?.email ?? null,
    team_name: sub.participants?.team_name ?? null,
    mentor: sub.participants?.mentor ?? null,
    total: sub.total_scores?.total ?? null,
    grade: sub.total_scores?.grade ?? null,
    needs_review: sub.total_scores?.needs_review ?? false,
    scores: scoresMap[sub.id] ?? {},
    section_analytics: sub.section_analytics ?? null,
    section_idea: sub.section_idea ?? null,
    section_steps: sub.section_steps ?? null,
    section_budget: sub.section_budget ?? null,
    pptx_file_path: sub.pptx_file_path ?? null,
    idea_attachment_path: sub.idea_attachment_path ?? null,
    steps_attachment_path: sub.steps_attachment_path ?? null,
  }))

  return NextResponse.json({ data })
}
