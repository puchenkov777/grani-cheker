import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { parsePptx } from '@/lib/pptx-parser'
import { extractTextFromFile } from '@/lib/file-text-extractor'
import {
  getSystemPrompt as analyticsSystem,
  getUserPrompt as analyticsUser,
} from '@/lib/prompts/analytics'
import {
  getSystemPrompt as ideaSystem,
  getUserPrompt as ideaUser,
} from '@/lib/prompts/idea'
import {
  getSystemPrompt as stepsSystem,
  getUserPrompt as stepsUser,
} from '@/lib/prompts/steps'
import {
  getSystemPrompt as budgetSystem,
  getUserPrompt as budgetUser,
} from '@/lib/prompts/budget'
import {
  getSystemPrompt as presentationSystem,
  getUserPrompt as presentationUser,
} from '@/lib/prompts/presentation'
import {
  getSystemPrompt as crossValidationSystem,
  getUserPrompt as crossValidationUser,
} from '@/lib/prompts/cross-validation'
import {
  getSystemPrompt as taskComplianceSystem,
  getUserPrompt as taskComplianceUser,
} from '@/lib/prompts/task-compliance'
import {
  VALID_SCORES,
  VALID_CROSS_SCORES,
  calculateGrade,
  type SectionKey,
  type ScoreResult,
} from '@/lib/scoring'

interface SectionConfig {
  key: SectionKey
  field: string
  getSystemPrompt: () => string
  getUserPrompt: (text: string) => string
}

const TEXT_SECTIONS: SectionConfig[] = [
  {
    key: 'analytics',
    field: 'section_analytics',
    getSystemPrompt: analyticsSystem,
    getUserPrompt: analyticsUser,
  },
  {
    key: 'idea',
    field: 'section_idea',
    getSystemPrompt: ideaSystem,
    getUserPrompt: ideaUser,
  },
  {
    key: 'steps',
    field: 'section_steps',
    getSystemPrompt: stepsSystem,
    getUserPrompt: stepsUser,
  },
  {
    key: 'budget',
    field: 'section_budget',
    getSystemPrompt: budgetSystem,
    getUserPrompt: budgetUser,
  },
]

async function evaluateSection(
  systemPrompt: string,
  userPrompt: string,
  validScores: number[] = VALID_SCORES
): Promise<ScoreResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from OpenAI')
  }

  const parsed: ScoreResult = JSON.parse(content)

  if (!validScores.includes(parsed.score)) {
    throw new Error(
      `Invalid score ${parsed.score}. Must be one of: ${validScores.join(', ')}`
    )
  }

  return parsed
}

export async function POST(request: NextRequest) {
  let submissionId: string | undefined

  try {
    const body = await request.json()
    submissionId = body.submission_id

    if (!submissionId) {
      return NextResponse.json(
        { error: 'submission_id is required' },
        { status: 400 }
      )
    }

    // Update status to 'checking'
    await supabase
      .from('submissions')
      .update({ status: 'checking' })
      .eq('id', submissionId)

    // Fetch submission data
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (fetchError || !submission) {
      throw new Error(
        `Failed to fetch submission: ${fetchError?.message ?? 'not found'}`
      )
    }

    // Prepare presentation text if pptx exists
    let presentationText = ''
    let presentationSlideCount = 0
    let presentationHasImages = false

    if (submission.pptx_file_path) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('submissions')
          .download(submission.pptx_file_path)

        if (downloadError) {
          throw new Error(`Failed to download pptx: ${downloadError.message}`)
        }

        const buffer = await fileData.arrayBuffer()
        const pptxData = await parsePptx(buffer)

        presentationText = pptxData.text
        presentationSlideCount = pptxData.slideCount
        presentationHasImages = pptxData.hasImages

        // Save parsed text back to submission
        await supabase
          .from('submissions')
          .update({
            pptx_parsed_text: pptxData.text,
            pptx_slide_count: pptxData.slideCount,
            pptx_has_images: pptxData.hasImages,
          })
          .eq('id', submissionId)
      } catch (pptxError) {
        console.error('Failed to parse pptx:', pptxError)
      }
    }

    let needsReview = false
    let successCount = 0
    const run1Scores: Partial<Record<SectionKey, number>> = {}

    // Extract text from attachment files (idea + steps)
    let ideaAttachmentText = ''
    let stepsAttachmentText = ''

    if (submission.idea_attachment_path) {
      try {
        const { data: fileData } = await supabase.storage
          .from('submissions')
          .download(submission.idea_attachment_path)
        if (fileData) {
          const buf = await fileData.arrayBuffer()
          ideaAttachmentText = await extractTextFromFile(buf, submission.idea_attachment_path)
        }
      } catch (e) {
        console.error('Failed to extract idea attachment text:', e)
      }
    }

    if (submission.steps_attachment_path) {
      try {
        const { data: fileData } = await supabase.storage
          .from('submissions')
          .download(submission.steps_attachment_path)
        if (fileData) {
          const buf = await fileData.arrayBuffer()
          stepsAttachmentText = await extractTextFromFile(buf, submission.steps_attachment_path)
        }
      } catch (e) {
        console.error('Failed to extract steps attachment text:', e)
      }
    }

    // Process text sections (analytics, idea, steps, budget)
    for (const section of TEXT_SECTIONS) {
      let text = submission[section.field]
      if (!text) {
        console.warn(`No text for section ${section.key}, skipping`)
        continue
      }

      // Append attachment content for idea and steps
      if (section.key === 'idea') {
        const extras: string[] = []
        if (submission.idea_file_description) {
          extras.push(`\n\n--- ОПИСАНИЕ ПРИЛОЖЕННОЙ СХЕМЫ/ТАБЛИЦЫ ---\n${submission.idea_file_description}`)
        }
        if (ideaAttachmentText) {
          extras.push(`\n\n--- ТЕКСТ ИЗ ПРИЛОЖЕННОГО ФАЙЛА ---\n${ideaAttachmentText}`)
        }
        if (extras.length) text = text + extras.join('')
      }

      if (section.key === 'steps') {
        const extras: string[] = []
        if (submission.steps_file_description) {
          extras.push(`\n\n--- ОПИСАНИЕ ПРИЛОЖЕННОЙ СХЕМЫ/ТАЙМЛАЙНА ---\n${submission.steps_file_description}`)
        }
        if (stepsAttachmentText) {
          extras.push(`\n\n--- ТЕКСТ ИЗ ПРИЛОЖЕННОГО ФАЙЛА ---\n${stepsAttachmentText}`)
        }
        if (extras.length) text = text + extras.join('')
      }

      try {
        const systemPrompt = section.getSystemPrompt()
        const userPrompt = section.getUserPrompt(text)

        // Run 1
        const result1 = await evaluateSection(systemPrompt, userPrompt)
        run1Scores[section.key] = result1.score

        await supabase.from('scores').insert({
          submission_id: submissionId,
          section: section.key,
          run_number: 1,
          score: result1.score,
          reasoning: result1.reasoning,
          strengths: result1.strengths,
          weaknesses: result1.weaknesses,
          criteria_details: result1,
        })

        // Run 2
        const result2 = await evaluateSection(systemPrompt, userPrompt)

        if (result1.score !== result2.score) {
          needsReview = true
        }

        await supabase.from('scores').insert({
          submission_id: submissionId,
          section: section.key,
          run_number: 2,
          score: result2.score,
          reasoning: result2.reasoning,
          strengths: result2.strengths,
          weaknesses: result2.weaknesses,
          criteria_details: result2,
        })

        successCount++
      } catch (sectionError) {
        console.error(`Error evaluating section ${section.key}:`, sectionError)
      }
    }

    // Process presentation section
    try {
      let presText = presentationText || submission.pptx_parsed_text || ''

      // Append user comment about the presentation
      if (submission.pptx_comment) {
        presText = presText + `\n\n--- КОММЕНТАРИЙ УЧАСТНИКА К ПРЕЗЕНТАЦИИ ---\n${submission.pptx_comment}`
      }

      if (presText) {
        const systemPrompt = presentationSystem()
        const userPrompt = presentationUser({
          text: presText,
          slideCount: presentationSlideCount,
          hasImages: presentationHasImages,
        })

        // Run 1
        const result1 = await evaluateSection(systemPrompt, userPrompt)
        run1Scores.presentation = result1.score

        await supabase.from('scores').insert({
          submission_id: submissionId,
          section: 'presentation',
          run_number: 1,
          score: result1.score,
          reasoning: result1.reasoning,
          strengths: result1.strengths,
          weaknesses: result1.weaknesses,
          criteria_details: result1,
        })

        // Run 2
        const result2 = await evaluateSection(systemPrompt, userPrompt)

        if (result1.score !== result2.score) {
          needsReview = true
        }

        await supabase.from('scores').insert({
          submission_id: submissionId,
          section: 'presentation',
          run_number: 2,
          score: result2.score,
          reasoning: result2.reasoning,
          strengths: result2.strengths,
          weaknesses: result2.weaknesses,
          criteria_details: result2,
        })

        successCount++
      }
    } catch (presError) {
      console.error('Error evaluating presentation:', presError)
    }

    // Cross-validation: проверка связности между разделами
    try {
      const crossSystemPrompt = crossValidationSystem()
      const crossUserPrompt = crossValidationUser({
        analytics: submission.section_analytics || '',
        idea: submission.section_idea || '',
        steps: submission.section_steps || '',
        budget: submission.section_budget || '',
        presentation: presentationText || submission.pptx_parsed_text || '',
      })

      const crossResult1 = await evaluateSection(crossSystemPrompt, crossUserPrompt, VALID_CROSS_SCORES)
      run1Scores.cross_validation = crossResult1.score

      await supabase.from('scores').insert({
        submission_id: submissionId,
        section: 'cross_validation',
        run_number: 1,
        score: crossResult1.score,
        reasoning: crossResult1.reasoning,
        strengths: crossResult1.strengths,
        weaknesses: crossResult1.weaknesses,
        criteria_details: crossResult1,
      })

      const crossResult2 = await evaluateSection(crossSystemPrompt, crossUserPrompt, VALID_CROSS_SCORES)

      if (crossResult1.score !== crossResult2.score) {
        needsReview = true
      }

      await supabase.from('scores').insert({
        submission_id: submissionId,
        section: 'cross_validation',
        run_number: 2,
        score: crossResult2.score,
        reasoning: crossResult2.reasoning,
        strengths: crossResult2.strengths,
        weaknesses: crossResult2.weaknesses,
        criteria_details: crossResult2,
      })

      successCount++
    } catch (crossError) {
      console.error('Error in cross-validation:', crossError)
    }

    // Task compliance: оценка соответствия условию задания (если есть case_id)
    if (submission.case_id) {
      try {
        const { data: caseData } = await supabase
          .from('cases')
          .select('task_text')
          .eq('id', submission.case_id)
          .single()

        if (caseData?.task_text) {
          const tcSystemPrompt = taskComplianceSystem()
          const tcUserPrompt = taskComplianceUser(caseData.task_text, {
            analytics: submission.section_analytics || '',
            idea: submission.section_idea || '',
            steps: submission.section_steps || '',
            budget: submission.section_budget || '',
            presentation: presentationText || submission.pptx_parsed_text || '',
          })

          const tcResult1 = await evaluateSection(tcSystemPrompt, tcUserPrompt, VALID_CROSS_SCORES)
          run1Scores.task_compliance = tcResult1.score

          await supabase.from('scores').insert({
            submission_id: submissionId,
            section: 'task_compliance',
            run_number: 1,
            score: tcResult1.score,
            reasoning: tcResult1.reasoning,
            strengths: tcResult1.strengths,
            weaknesses: tcResult1.weaknesses,
            criteria_details: tcResult1,
          })

          const tcResult2 = await evaluateSection(tcSystemPrompt, tcUserPrompt, VALID_CROSS_SCORES)

          if (tcResult1.score !== tcResult2.score) {
            needsReview = true
          }

          await supabase.from('scores').insert({
            submission_id: submissionId,
            section: 'task_compliance',
            run_number: 2,
            score: tcResult2.score,
            reasoning: tcResult2.reasoning,
            strengths: tcResult2.strengths,
            weaknesses: tcResult2.weaknesses,
            criteria_details: tcResult2,
          })

          successCount++
        }
      } catch (tcError) {
        console.error('Error in task compliance:', tcError)
      }
    }

    // If everything failed, mark as error
    if (successCount === 0) {
      await supabase
        .from('submissions')
        .update({ status: 'error' })
        .eq('id', submissionId)

      return NextResponse.json(
        { error: 'All sections failed to evaluate' },
        { status: 500 }
      )
    }

    // Calculate total score (без кросс-валидации и task_compliance — только 5 основных разделов)
    const { cross_validation: _cv, task_compliance: _tc, ...mainScores } = run1Scores
    const totalScore = Object.values(mainScores).reduce(
      (sum, score) => sum + (score ?? 0),
      0
    )
    const grade = calculateGrade(totalScore)

    // Save to total_scores
    await supabase.from('total_scores').insert({
      submission_id: submissionId,
      total: totalScore,
      grade,
      needs_review: needsReview,
    })

    // Update submission status
    const finalStatus = needsReview ? 'review' : 'done'
    await supabase
      .from('submissions')
      .update({ status: finalStatus })
      .eq('id', submissionId)

    return NextResponse.json({
      success: true,
      submission_id: submissionId,
      total_score: totalScore,
      grade,
      needs_review: needsReview,
    })
  } catch (error) {
    console.error('Check route error:', error)

    if (submissionId) {
      try {
        await supabase
          .from('submissions')
          .update({ status: 'error' })
          .eq('id', submissionId)
      } catch {
        // best effort
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
