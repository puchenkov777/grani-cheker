CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  mentor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  task_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  team_name TEXT,
  mentor TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  case_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'done', 'error', 'review')),
  section_analytics TEXT,
  section_idea TEXT,
  section_steps TEXT,
  section_budget TEXT,
  pptx_file_path TEXT,
  pptx_parsed_text TEXT,
  pptx_slide_count INTEGER,
  pptx_has_images BOOLEAN NOT NULL DEFAULT false,
  idea_attachment_path TEXT,
  steps_attachment_path TEXT,
  idea_file_description TEXT,
  steps_file_description TEXT,
  pptx_comment TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('analytics', 'idea', 'steps', 'budget', 'presentation', 'cross_validation', 'task_compliance')),
  score INTEGER NOT NULL CHECK (score IN (0, 1, 2, 3, 4, 10, 20, 30, 40)),
  reasoning TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  criteria_details JSONB,
  run_number INTEGER NOT NULL DEFAULT 1,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS total_scores (
  submission_id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  total INTEGER NOT NULL,
  grade TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_participant ON submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_case ON submissions(case_id);
CREATE INDEX IF NOT EXISTS idx_scores_submission ON scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
