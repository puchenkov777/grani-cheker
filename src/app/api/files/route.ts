import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessMentor, getMentorSession } from '@/lib/mentor-session'

export async function GET(request: NextRequest) {
  const session = getMentorSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const { data, error } = await db.from('submissions')
    .select('id, participant_id').eq('pptx_file_path', path)
  const { data: idea } = await db.from('submissions')
    .select('id, participant_id').eq('idea_attachment_path', path)
  const { data: steps } = await db.from('submissions')
    .select('id, participant_id').eq('steps_attachment_path', path)
  if (error || (!data?.length && !idea?.length && !steps?.length)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
  const submission = data?.[0] || idea?.[0] || steps?.[0]
  const { data: participant } = await db.from('participants').select('mentor').eq('id', submission.participant_id).single()
  if (!canAccessMentor(session, participant?.mentor ?? null)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await db.storage.from('submissions').download(path)
  if (result.error || !result.data) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  return new NextResponse(result.data, {
    headers: {
      'Content-Type': result.data.type || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment',
    },
  })
}
