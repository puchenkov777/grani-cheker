import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function uploadFile(
  participantId: string,
  file: File,
  prefix: string
): Promise<string | null> {
  if (!file || file.size === 0) return null

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = `${participantId}/${Date.now()}_${prefix}.${ext}`

  const { error } = await supabase.storage
    .from('submissions')
    .upload(safeName, file, {
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
    const ideaFileDescription = formData.get('idea_file_description') as string | null
    const stepsFileDescription = formData.get('steps_file_description') as string | null
    const pptxComment = formData.get('pptx_comment') as string | null

    // Validate required fields
    if (!name || !caseTitle) {
      return NextResponse.json(
        { error: 'Имя и название кейса обязательны' },
        { status: 400 }
      )
    }

    // Create participant (use name as unique key, no email)
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({ name, mentor: mentor || null })
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
    const pptxFilePath = pptxFile ? await uploadFile(participant.id, pptxFile, 'presentation') : null
    const ideaFilePath = ideaAttachment ? await uploadFile(participant.id, ideaAttachment, 'idea_attachment') : null
    const stepsFilePath = stepsAttachment ? await uploadFile(participant.id, stepsAttachment, 'steps_attachment') : null

    // Create submission
    const { data: submission, error: submissionError } = await supabase
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
        status: 'pending',
      })
      .select('id')
      .single()

    if (submissionError) {
      console.error('Submission error:', submissionError)
      return NextResponse.json(
        { error: 'Ошибка создания работы: ' + submissionError.message },
        { status: 500 }
      )
    }

    // Trigger async check (fire and forget)
    const baseUrl = request.nextUrl.origin
    fetch(`${baseUrl}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: submission.id }),
    }).catch(console.error)

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
