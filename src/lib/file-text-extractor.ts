import JSZip from 'jszip'

/**
 * Extract text from PDF (basic — extracts visible text streams).
 * For production use a library like pdf-parse, but it requires node buffer.
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
 * Detect file type and extract text.
 * Returns extracted text or empty string.
 */
export async function extractTextFromFile(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  switch (ext) {
    case 'pdf':
      return extractTextFromPdf(buffer)
    case 'docx':
    case 'doc':
      return extractTextFromDocx(buffer)
    default:
      return ''
  }
}
