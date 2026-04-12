-- Таблица кейсов (условия заданий загруженные участниками)
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    task_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Связь submissions с cases
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id) ON DELETE SET NULL;

-- Добавить section cross_validation и task_compliance в scores
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_section_check;
ALTER TABLE scores ADD CONSTRAINT scores_section_check CHECK (section IN ('analytics', 'idea', 'steps', 'budget', 'presentation', 'cross_validation', 'task_compliance'));

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_case ON submissions(case_id);

-- RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert cases" ON cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read cases" ON cases FOR SELECT USING (true);
CREATE POLICY "Allow anonymous delete cases" ON cases FOR DELETE USING (true);
