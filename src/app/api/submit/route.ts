import { after, NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkToken } from '@/lib/mentor-session'

export const maxDuration = 300

async function uploadFile(
  participantId: string,
  file: File,
  prefix: string
): Promise<string | null> {
  if (!file || file.size === 0) return null

  const fileCounter = crypto.randomUUID()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = `${participantId}/${fileCounter}_${prefix}.${ext}`

  // Store with an ASCII pathname to support Cyrillic original filenames.
  const safeFile = new File([file], `${fileCounter}_${prefix}.${ext}`, { type: file.type })

  const { error } = await db.storage
    .from('submissions')
    .upload(safeName, safeFile, {
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    console.error(`Upload error (${prefix}):`, error)
    throw new Error(`Ошибка загрузки файла ${prefix}: ${error.message}`)
  }

  return safeName
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const name = formData.get('name') as string
    const mentor = formData.get('mentor') as string
    const caseTitle = formData.get('case_title') as string
    const sectionAnalytics = formData.get('section_analytics') as string
    const sectionIdea = formData.get('section_idea') as string
    const sectionSteps = formData.get('section_steps') as string
    const sectionBudget = formData.get('section_budget') as string
    const pptxFile = formData.get('pptx_file') as File | null
    const ideaAttachment = formData.get('idea_attachment') as File | null
    const stepsAttachment = formData.get('steps_attachment') as File | null
    const directPath = (key: string) => {
      const path = formData.get(key)?.toString() || null
      if (path && !/^uploads\/[0-9a-f-]{36}_(presentation|idea_attachment|steps_attachment)\.(pptx|pdf|docx|doc|jpg|jpeg|png|webp)$/i.test(path)) {
        throw new Error('Недопустимый путь вложения')
      }
      return path
    }
    const ideaFileDescription = formData.get('idea_file_description') as string | null
    const stepsFileDescription = formData.get('steps_file_description') as string | null
    const pptxComment = formData.get('pptx_comment') as string | null
    const userIdRaw = formData.get('user_id') as string | null
    const caseIdRaw = formData.get('case_id') as string | null

    // Validate required fields
    if (!name || !caseTitle) {
      return NextResponse.json(
        { error: 'Имя и название кейса обязательны' },
        { status: 400 }
      )
    }

    // Create participant (use name as unique key, no email)
    const { data: participant, error: participantError } = await db
      .from('participants')
      .insert({ name, mentor: mentor || null, user_id: userIdRaw || null })
      .select('id')
      .single()

    if (participantError) {
      console.error('Participant error:', participantError)
      return NextResponse.json(
        { error: 'Ошибка создания участника: ' + participantError.message },
        { status: 500 }
      )
    }

    // Upload files
    const pptxFilePath = directPath('pptx_file_path') || (pptxFile ? await uploadFile(participant.id, pptxFile, 'presentation') : null)
    const ideaFilePath = directPath('idea_attachment_path') || (ideaAttachment ? await uploadFile(participant.id, ideaAttachment, 'idea_attachment') : null)
    const stepsFilePath = directPath('steps_attachment_path') || (stepsAttachment ? await uploadFile(participant.id, stepsAttachment, 'steps_attachment') : null)

    // Create submission
    const { data: submission, error: submissionError } = await db
      .from('submissions')
      .insert({
        participant_id: participant.id,
        case_title: caseTitle,
        section_analytics: sectionAnalytics || null,
        section_idea: sectionIdea || null,
        section_steps: sectionSteps || null,
        section_budget: sectionBudget || null,
        pptx_file_path: pptxFilePath,
        idea_attachment_path: ideaFilePath,
        steps_attachment_path: stepsFilePath,
        idea_file_description: ideaFileDescription || null,
        steps_file_description: stepsFileDescription || null,
        pptx_comment: pptxComment || null,
        user_id: userIdRaw || null,
        case_id: caseIdRaw || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (submissionError || !submission) {
      console.error('Submission error:', submissionError)
      return NextResponse.json(
        { error: 'Ошибка создания работы: ' + (submissionError?.message ?? 'unknown') },
        { status: 500 }
      )
    }

    // Trigger async check (fire and forget)
    const baseUrl = request.nextUrl.origin
    after(async () => {
      await fetch(`${baseUrl}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-check-token': checkToken(submission.id) },
        body: JSON.stringify({ submission_id: submission.id }),
      })
    })

    return NextResponse.json({
      success: true,
      submission_id: submission.id,
    })
  } catch (error) {
    console.error('Submit error:', error)
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// PUT — update existing submission and re-check
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()

    const submissionId = formData.get('submission_id') as string
    const userIdRaw = formData.get('user_id') as string
    const caseTitle = formData.get('case_title') as string
    const sectionAnalytics = formData.get('section_analytics') as string
    const sectionIdea = formData.get('section_idea') as string
    const sectionSteps = formData.get('section_steps') as string
    const sectionBudget = formData.get('section_budget') as string
    const pptxFile = formData.get('pptx_file') as File | null
    const ideaAttachment = formData.get('idea_attachment') as File | null
    const stepsAttachment = formData.get('steps_attachment') as File | null
    const directPath = (key: string) => {
      const path = formData.get(key)?.toString() || undefined
      if (path && !/^uploads\/[0-9a-f-]{36}_(presentation|idea_attachment|steps_attachment)\.(pptx|pdf|docx|doc|jpg|jpeg|png|webp)$/i.test(path)) {
        throw new Error('Недопустимый путь вложения')
      }
      return path
    }
    const pptxComment = formData.get('pptx_comment') as string | null
    const caseIdRaw = formData.get('case_id') as string | null

    if (!submissionId || !userIdRaw) {
      return NextResponse.json({ error: 'submission_id и user_id обязательны' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await db
      .from('submissions')
      .select('id, participant_id')
      .eq('id', submissionId)
      .eq('user_id', userIdRaw)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Работа не найдена' }, { status: 404 })
    }

    // Upload new files (only if provided)
    const pptxFilePath = directPath('pptx_file_path') || (pptxFile && pptxFile.size > 0 ? await uploadFile(existing.participant_id, pptxFile, 'presentation') : undefined)
    const ideaFilePath = directPath('idea_attachment_path') || (ideaAttachment && ideaAttachment.size > 0 ? await uploadFile(existing.participant_id, ideaAttachment, 'idea_attachment') : undefined)
    const stepsFilePath = directPath('steps_attachment_path') || (stepsAttachment && stepsAttachment.size > 0 ? await uploadFile(existing.participant_id, stepsAttachment, 'steps_attachment') : undefined)

    // Build update object (only include file paths if new files were uploaded)
    const updateData: Record<string, unknown> = {
      case_title: caseTitle || undefined,
      section_analytics: sectionAnalytics || null,
      section_idea: sectionIdea || null,
      section_steps: sectionSteps || null,
      section_budget: sectionBudget || null,
      pptx_comment: pptxComment || null,
      case_id: caseIdRaw || null,
      status: 'pending',
    }
    if (pptxFilePath) updateData.pptx_file_path = pptxFilePath
    if (ideaFilePath) updateData.idea_attachment_path = ideaFilePath
    if (stepsFilePath) updateData.steps_attachment_path = stepsFilePath

    const { error: updateError } = await db
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)

    if (updateError) {
      return NextResponse.json({ error: 'Ошибка обновления: ' + updateError.message }, { status: 500 })
    }

    // Delete old scores and total_scores
    await db.from('scores').delete().eq('submission_id', submissionId)
    await db.from('total_scores').delete().eq('submission_id', submissionId)

    // Trigger re-check
    const baseUrl = request.nextUrl.origin
    after(async () => {
      await fetch(`${baseUrl}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-check-token': checkToken(submissionId) },
        body: JSON.stringify({ submission_id: submissionId }),
      })
    })

    return NextResponse.json({ success: true, submission_id: submissionId })
  } catch (error) {
    console.error('Update error:', error)
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
