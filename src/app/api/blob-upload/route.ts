import { issueSignedToken, presignUrl } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

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
