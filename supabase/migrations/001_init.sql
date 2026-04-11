-- Участники
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    team_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Сданные работы
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    case_title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'done', 'error', 'review')),
    section_analytics TEXT,
    section_idea TEXT,
    section_steps TEXT,
    section_budget TEXT,
    pptx_file_path TEXT,
    pptx_parsed_text TEXT,
    pptx_slide_count INT,
    pptx_has_images BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Результаты проверки
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('analytics', 'idea', 'steps', 'budget', 'presentation')),
    score INT NOT NULL CHECK (score IN (0, 10, 20, 30, 40)),
    reasoning TEXT NOT NULL,
    strengths JSONB DEFAULT '[]',
    weaknesses JSONB DEFAULT '[]',
    criteria_details JSONB,
    run_number INT DEFAULT 1,
    checked_at TIMESTAMPTZ DEFAULT now()
);

-- Итоговый балл
CREATE TABLE total_scores (
    submission_id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    total INT NOT NULL,
    grade TEXT,
    needs_review BOOLEAN DEFAULT false,
    checked_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы
CREATE INDEX idx_submissions_participant ON submissions(participant_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_scores_submission ON scores(submission_id);

-- RLS (Row Level Security) - базовые политики
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE total_scores ENABLE ROW LEVEL SECURITY;

-- Разрешить анонимную вставку участников и работ
CREATE POLICY "Allow anonymous insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous insert submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read own submissions" ON submissions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read scores" ON scores FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read total_scores" ON total_scores FOR SELECT USING (true);
CREATE POLICY "Allow service insert scores" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert total_scores" ON total_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update submissions" ON submissions FOR UPDATE USING (true);
CREATE POLICY "Allow service upsert total_scores" ON total_scores FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous read participants" ON participants FOR SELECT USING (true);

-- Storage bucket для PPTX файлов
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false)
ON CONFLICT DO NOTHING;
