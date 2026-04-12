import JSZip from 'jszip'
import type OpenAI from 'openai'

/**
 * Extract text from PDF (basic — extracts visible text streams).
 */
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  try {
    // @ts-expect-error pdf-parse has no type declarations
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(Buffer.from(buffer))
    return result.text || ''
  } catch {
    return ''
  }
}

/**
 * Extract text from DOCX file (same approach as PPTX — parse XML from ZIP).
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const docXml = zip.files['word/document.xml']
    if (!docXml) return ''

    const xml = await docXml.async('text')
    // Extract text between <w:t> tags
    const texts = xml
      .replace(/<w:t[^>]*>/g, '|||T|||')
      .replace(/<\/w:t>/g, '|||/T|||')
      .replace(/<[^>]+>/g, '')
      .split('|||T|||')
      .filter((part: string) => part.includes('|||/T|||'))
      .map((part: string) => part.split('|||/T|||')[0].trim())
      .filter(Boolean)

    return texts.join(' ')
  } catch {
    return ''
  }
}

/**
 * OCR: extract text from image using OpenAI Vision API (gpt-4o-mini).
 */
export async function extractTextFromImage(buffer: ArrayBuffer, openaiClient: OpenAI): Promise<string> {
  try {
    const base64 = Buffer.from(buffer).toString('base64')
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Извлеки ВСЬ текст с этого изображения. Если это схема, таблица или диаграмма — опиши её структуру и содержимое. Если на изображении нет текста — опиши что изображено. Отвечай только содержимым, без вступлений.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content || ''
  } catch (e) {
    console.error('OCR error:', e)
    return ''
  }
}

/**
 * Detect file type and extract text.
 * Pass openaiClient for OCR on images.
 */
export async function extractTextFromFile(
  buffer: ArrayBuffer,
  fileName: string,
  openaiClient?: OpenAI
): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  switch (ext) {
    case 'pdf':
      return extractTextFromPdf(buffer)
    case 'docx':
    case 'doc':
      return extractTextFromDocx(buffer)
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
      if (openaiClient) {
        return extractTextFromImage(buffer, openaiClient)
      }
      return ''
    default:
      return ''
  }
}
