import { del, issueSignedToken, presignUrl } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMentorSession } from '@/lib/mentor-session'

const pathPattern = /^uploads\/[0-9a-f-]{36}_(presentation|idea_attachment|steps_attachment)\.(pptx|pdf|docx|doc|jpg|jpeg|png|webp)$/i
const allowedContentTypes = new Set([
  'application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword', 'image/jpeg', 'image/png', 'image/webp',
  'application/octet-stream',
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pathname = typeof body.pathname === 'string' ? body.pathname : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : ''
    const size = Number(body.size)
    if (!pathPattern.test(pathname) || !allowedContentTypes.has(contentType) || !Number.isInteger(size) || size < 1 || size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Недопустимый файл или размер более 15 МБ' }, { status: 400 })
    }

    const validUntil = Date.now() + 15 * 60 * 1000
    const token = await issueSignedToken({
      pathname, operations: ['put'], validUntil,
      allowedContentTypes: [contentType], maximumSizeInBytes: size,
    })
    const { presignedUrl } = await presignUrl(token, {
      access: 'private', operation: 'put', pathname, validUntil,
      allowedContentTypes: [contentType], maximumSizeInBytes: size,
      addRandomSuffix: false,
    })
    return NextResponse.json({ presignedUrl, pathname })
  } catch (error) {
    console.error('Blob presign failed:', error)
    return NextResponse.json({ error: 'Ошибка подготовки загрузки' }, { status: 500 })
  }
}

// Administrators can remove uploads that were never attached to a submission.
export async function DELETE(request: NextRequest) {
  const session = getMentorSession(request)
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const pathname = request.nextUrl.searchParams.get('path') || ''
  if (!pathPattern.test(pathname)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  for (const column of ['pptx_file_path', 'idea_attachment_path', 'steps_attachment_path'] as const) {
    const { data, error } = await db.from('submissions').select('id').eq(column, pathname)
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })
    if (data?.length) return NextResponse.json({ error: 'File is attached to a submission' }, { status: 409 })
  }
  await del(pathname)
  return NextResponse.json({ deleted: true })
}
