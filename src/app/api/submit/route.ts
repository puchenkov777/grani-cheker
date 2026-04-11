import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const teamName = formData.get('team_name') as string | null
    const caseTitle = formData.get('case_title') as string
    const sectionAnalytics = formData.get('section_analytics') as string
    const sectionIdea = formData.get('section_idea') as string
    const sectionSteps = formData.get('section_steps') as string
    const sectionBudget = formData.get('section_budget') as string
    const pptxFile = formData.get('pptx_file') as File | null

    // Validate required fields
    if (!name || !email || !caseTitle) {
      return NextResponse.json(
        { error: 'Имя, email и название кейса обязательны' },
        { status: 400 }
      )
    }

    // Upsert participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .upsert(
        { name, email, team_name: teamName || null },
        { onConflict: 'email' }
      )
      .select('id')
      .single()

    if (participantError) {
      console.error('Participant error:', participantError)
      return NextResponse.json(
        { error: 'Ошибка создания участника: ' + participantError.message },
        { status: 500 }
      )
    }

    // Upload PPTX if provided
    let pptxFilePath: string | null = null
    if (pptxFile && pptxFile.size > 0) {
      // Supabase Storage не принимает кириллицу в именах — используем безопасное имя
      const safeFileName = `${participant.id}/${Date.now()}_presentation.pptx`
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(safeFileName, pptxFile, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json(
          { error: 'Ошибка загрузки файла: ' + uploadError.message },
          { status: 500 }
        )
      }
      pptxFilePath = safeFileName
    }

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
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
