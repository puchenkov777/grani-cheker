import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleUploadBody
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^uploads\/[0-9a-f-]{36}_(presentation|idea_attachment|steps_attachment)\.(pptx|pdf|docx|doc|jpg|jpeg|png|webp)$/i.test(pathname)) {
          throw new Error('Недопустимое имя файла')
        }
        return {
          allowedContentTypes: [
            'application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword', 'image/jpeg', 'image/png', 'image/webp',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: false,
        }
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ошибка загрузки' }, { status: 400 })
  }
}
