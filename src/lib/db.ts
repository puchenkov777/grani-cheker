/* The compatibility query builder keeps Supabase's dynamic result shape until API callers are typed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'

import { neon } from '@neondatabase/serverless'
import { get, put } from '@vercel/blob'

/* The old application used a small part of the Supabase query API. Keeping that
 * shape here makes the storage migration auditable while all SQL and credentials
 * stay on the server. Tables and columns are allowlisted before interpolation. */

const columns = {
  participants: ['id', 'name', 'email', 'team_name', 'mentor', 'user_id', 'created_at'],
  submissions: [
    'id', 'participant_id', 'case_title', 'status', 'section_analytics', 'section_idea',
    'section_steps', 'section_budget', 'pptx_file_path', 'pptx_parsed_text',
    'pptx_slide_count', 'pptx_has_images', 'idea_attachment_path',
    'steps_attachment_path', 'idea_file_description', 'steps_file_description',
    'pptx_comment', 'user_id', 'case_id', 'created_at',
  ],
  scores: [
    'id', 'submission_id', 'section', 'score', 'reasoning', 'strengths',
    'weaknesses', 'criteria_details', 'run_number', 'checked_at',
  ],
  total_scores: ['submission_id', 'total', 'grade', 'needs_review', 'checked_at'],
  users: ['id', 'telegram', 'password_hash', 'name', 'mentor', 'created_at'],
  drafts: ['user_id', 'data', 'updated_at'],
  cases: ['id', 'user_id', 'title', 'task_text', 'created_at'],
} as const

type Table = keyof typeof columns
type Row = Record<string, any>
type QueryResult = { data: any; error: Error | null }
type Filter = { column: string; value: any; kind: 'eq' | 'in' }

const jsonColumns = new Set(['strengths', 'weaknesses', 'criteria_details', 'data'])
let sqlClient: ReturnType<typeof neon> | undefined

export function sql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is missing')
    sqlClient = neon(url)
  }
  return sqlClient
}

export async function query(text: string, params: any[] = []): Promise<Row[]> {
  return await sql().query(text, params) as Row[]
}

function identifier(table: Table, column: string) {
  if (!(columns[table] as readonly string[]).includes(column)) {
    throw new Error(`Unknown column ${table}.${column}`)
  }
  return `"${column}"`
}

function stringifyValue(column: string, value: any) {
  return jsonColumns.has(column) ? JSON.stringify(value) : value
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private selected = '*'
  private payload: Row = {}
  private filters: Filter[] = []
  private ordering?: { column: string; ascending: boolean }
  private one = false

  constructor(private readonly table: Table) {}

  select(fields = '*') {
    this.selected = fields
    return this
  }

  insert(value: Row) {
    this.operation = 'insert'
    this.payload = value
    return this
  }

  upsert(value: Row, options?: { onConflict?: string }) {
    this.operation = 'upsert'
    this.payload = value
    if (options?.onConflict && options.onConflict !== 'user_id' && options.onConflict !== 'submission_id') {
      throw new Error('Unsupported conflict key')
    }
    return this
  }

  update(value: Row) {
    this.operation = 'update'
    this.payload = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: any) {
    identifier(this.table, column)
    this.filters.push({ column, value, kind: 'eq' })
    return this
  }

  in(column: string, values: any[]) {
    identifier(this.table, column)
    this.filters.push({ column, value: values, kind: 'in' })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    identifier(this.table, column)
    this.ordering = { column, ascending: options?.ascending !== false }
    return this
  }

  single(): Promise<QueryResult> {
    this.one = true
    return this.execute()
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private where(params: any[]) {
    if (this.filters.length === 0) return ''
    return ' WHERE ' + this.filters.map((filter) => {
      if (filter.kind === 'in') {
        const values = filter.value as any[]
        if (values.length === 0) return 'FALSE'
        const slots = values.map((value) => {
          params.push(value)
          return `$${params.length}`
        })
        return `${identifier(this.table, filter.column)} IN (${slots.join(', ')})`
      }
      params.push(filter.value)
      return `${identifier(this.table, filter.column)} = $${params.length}`
    }).join(' AND ')
  }

  private selection() {
    const joins = {
      participants: /(?:^|,)\s*participants\([^)]*\)/.test(this.selected),
      total_scores: /(?:^|,)\s*total_scores\([^)]*\)/.test(this.selected),
    }
    const base = this.selected
      .replace(/(?:^|,)\s*participants\([^)]*\)/g, '')
      .replace(/(?:^|,)\s*total_scores\([^)]*\)/g, '')
      .trim()
      .replace(/^,|,$/g, '')
      .trim()
    const fields = (base || '*').split(',').map((field) => field.trim())
    const selection = fields.includes('*') ? '*' : fields.map((field) => identifier(this.table, field)).join(', ')
    return { selection, joins }
  }

  private async addRelations(rows: Row[], joins: { participants: boolean; total_scores: boolean }) {
    if (this.table !== 'submissions' || rows.length === 0) return rows
    if (joins.participants) {
      const ids = [...new Set(rows.map((row) => row.participant_id).filter(Boolean))]
      const related = ids.length ? await query(`SELECT * FROM participants WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})`, ids) : []
      const byId = new Map(related.map((row) => [row.id, row]))
      for (const row of rows) row.participants = byId.get(row.participant_id) ?? null
    }
    if (joins.total_scores) {
      const ids = rows.map((row) => row.id)
      const related = await query(`SELECT * FROM total_scores WHERE submission_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})`, ids)
      const byId = new Map(related.map((row) => [row.submission_id, row]))
      for (const row of rows) row.total_scores = byId.get(row.id) ?? null
    }
    return rows
  }

  private async execute(): Promise<QueryResult> {
    try {
      const params: any[] = []
      let statement = ''
      const tableName = `"${this.table}"`
      const { selection, joins } = this.selection()

      if (this.operation === 'select') {
        statement = `SELECT ${selection} FROM ${tableName}${this.where(params)}`
        if (this.ordering) statement += ` ORDER BY ${identifier(this.table, this.ordering.column)} ${this.ordering.ascending ? 'ASC' : 'DESC'}`
        if (this.one) statement += ' LIMIT 2'
      } else if (this.operation === 'insert' || this.operation === 'upsert') {
        const keys = Object.keys(this.payload)
        if (keys.length === 0) throw new Error('Empty insert')
        const names = keys.map((key) => identifier(this.table, key))
        const slots = keys.map((key) => {
          params.push(stringifyValue(key, this.payload[key]))
          return `$${params.length}${jsonColumns.has(key) ? '::jsonb' : ''}`
        })
        statement = `INSERT INTO ${tableName} (${names.join(', ')}) VALUES (${slots.join(', ')})`
        if (this.operation === 'upsert') {
          const conflict = this.table === 'drafts' ? 'user_id' : this.table === 'total_scores' ? 'submission_id' : 'id'
          statement += ` ON CONFLICT (${identifier(this.table, conflict)}) DO UPDATE SET ${keys.filter((key) => key !== conflict).map((key) => `${identifier(this.table, key)} = EXCLUDED.${identifier(this.table, key)}`).join(', ')}`
        }
        statement += ` RETURNING ${selection}`
      } else if (this.operation === 'update') {
        const keys = Object.keys(this.payload)
        if (keys.length === 0 || this.filters.length === 0) throw new Error('Unsafe update')
        const assigns = keys.map((key) => {
          params.push(stringifyValue(key, this.payload[key]))
          return `${identifier(this.table, key)} = $${params.length}${jsonColumns.has(key) ? '::jsonb' : ''}`
        })
        statement = `UPDATE ${tableName} SET ${assigns.join(', ')}${this.where(params)} RETURNING ${selection}`
      } else {
        if (this.filters.length === 0) throw new Error('Unsafe delete')
        statement = `DELETE FROM ${tableName}${this.where(params)} RETURNING ${selection}`
      }

      const rows = await this.addRelations(await query(statement, params), joins)
      if (this.one) {
        if (rows.length !== 1) return { data: null, error: new Error(rows.length ? 'Multiple rows' : 'No rows') }
        return { data: rows[0], error: null }
      }
      return { data: rows, error: null }
    } catch (cause) {
      return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }
    }
  }
}

export const db = {
  from(name: Table) {
    if (!(name in columns)) throw new Error(`Unknown table ${name}`)
    return new QueryBuilder(name)
  },
  storage: {
    from(bucket: string) {
      if (bucket !== 'submissions') throw new Error(`Unknown bucket ${bucket}`)
      return {
        async upload(path: string, file: File, options?: { contentType?: string; upsert?: boolean }) {
          try {
            const result = await put(path, file, {
              access: 'private',
              contentType: options?.contentType || file.type || 'application/octet-stream',
              allowOverwrite: options?.upsert === true,
            })
            return { data: { path: result.pathname }, error: null }
          } catch (cause) {
            return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }
          }
        },
        async download(path: string) {
          try {
            const result = await get(path, { access: 'private' })
            if (!result || result.statusCode !== 200) return { data: null, error: new Error('File not found') }
            return { data: await new Response(result.stream).blob(), error: null }
          } catch (cause) {
            return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }
          }
        },
      }
    },
  },
}
