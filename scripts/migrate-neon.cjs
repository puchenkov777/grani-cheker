/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is required');
const sql = neon(url);
const root = path.resolve(__dirname, '..');

async function main() {
  await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const dir = path.join(root, 'neon/migrations');
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const existing = await sql.query('SELECT name FROM schema_migrations WHERE name = $1', [file]);
    if (existing.length) continue;
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const statements = source.split(';').map((part) => part.trim()).filter(Boolean);
    for (const statement of statements) await sql.query(statement);
    await sql.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log(`Applied ${file}`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
