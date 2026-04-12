-- Таблица пользователей (участников)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    mentor TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Черновики (один черновик на пользователя, upsert)
CREATE TABLE IF NOT EXISTS drafts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Связь participants с users (опционально, если пользователь зарегистрирован)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Связь submissions с users
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert drafts" ON drafts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read drafts" ON drafts FOR SELECT USING (true);
CREATE POLICY "Allow anonymous update drafts" ON drafts FOR UPDATE USING (true);
