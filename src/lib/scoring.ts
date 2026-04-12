export type SectionKey = 'analytics' | 'idea' | 'steps' | 'budget' | 'presentation' | 'cross_validation' | 'task_compliance'

export interface ScoreResult {
  score: number
  reasoning: string
  strengths: string[]
  weaknesses: string[]
  [key: string]: unknown
}

export const VALID_SCORES = [0, 10, 20, 30, 40]
export const VALID_CROSS_SCORES = [0, 1, 2, 3, 4]

export function calculateGrade(total: number): string {
  // Макс: 5 разделов × 40 = 200
  if (total >= 160) return 'Отлично'
  if (total >= 120) return 'Хорошо'
  if (total >= 80) return 'Удовлетворительно'
  return 'Требует доработки'
}
