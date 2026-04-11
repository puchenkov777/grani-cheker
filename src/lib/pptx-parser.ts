import JSZip from 'jszip'

interface PptxData {
  text: string
  slideCount: number
  hasImages: boolean
  slideTitles: string[]
}

export async function parsePptx(buffer: ArrayBuffer): Promise<PptxData> {
  const zip = await JSZip.loadAsync(buffer)

  let slideCount = 0
  const allText: string[] = []
  const slideTitles: string[] = []
  let hasImages = false

  // Count slides and extract text
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return numA - numB
    })

  slideCount = slideFiles.length

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async('text')

    // Extract text content from XML (remove tags, keep text)
    const textContent = xml
      .replace(/<a:t>/g, '|||TEXT_START|||')
      .replace(/<\/a:t>/g, '|||TEXT_END|||')
      .replace(/<[^>]+>/g, '')
      .split('|||TEXT_START|||')
      .filter((part: string) => part.includes('|||TEXT_END|||'))
      .map((part: string) => part.split('|||TEXT_END|||')[0].trim())
      .filter(Boolean)

    if (textContent.length > 0) {
      // First text element is usually the title
      slideTitles.push(textContent[0])
      allText.push(`--- Слайд ${slideFiles.indexOf(slidePath) + 1} ---`)
      allText.push(textContent.join('\n'))
    }
  }

  // Check for images
  const imageFiles = Object.keys(zip.files).filter(
    (name) =>
      name.startsWith('ppt/media/') &&
      /\.(png|jpg|jpeg|gif|svg|emf|wmf)$/i.test(name)
  )
  hasImages = imageFiles.length > 0

  return {
    text: allText.join('\n\n'),
    slideCount,
    hasImages,
    slideTitles,
  }
}
