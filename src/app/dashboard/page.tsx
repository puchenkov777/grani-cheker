'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Submission {
  id: string
  case_title: string
  status: string
  created_at: string
  participant_name: string | null
  participant_email: string | null
  team_name: string | null
  total: number | null
  grade: string | null
  needs_review: boolean
  scores: Record<string, number>
}

type StatusFilter = 'all' | 'pending' | 'checking' | 'done' | 'review' | 'error'
type SortKey = 'total' | 'date'

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  checking: 'Проверяется',
  done: 'Проверено',
  review: 'На проверке',
  error: 'Ошибка',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  checking: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  review: 'bg-orange-pale text-orange border-orange/30',
  error: 'bg-red-100 text-red-600 border-red-300',
}

const SECTIONS = ['analytics', 'idea', 'steps', 'budget', 'presentation'] as const
const SECTION_HEADERS = ['Аналитика', 'Идея', 'Шаги', 'Бюджет', 'Презентация']

function scoreColorClass(score: number | undefined): string {
  if (score === undefined || score === null) return 'text-muted'
  if (score === 0) return 'bg-red-100 text-red-600'
  if (score === 10) return 'bg-orange-100 text-orange'
  if (score === 20) return 'bg-yellow-100 text-yellow-700'
  if (score === 30) return 'bg-lime-100 text-lime-700'
  if (score === 40) return 'bg-emerald-100 text-emerald-700'
  return 'text-muted'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function exportCSV(submissions: Submission[]) {
  const header = [
    'Имя',
    'Команда',
    'Кейс',
    'Аналитика',
    'Идея',
    'Шаги',
    'Бюджет',
    'Презентация',
    'Итого',
    'Статус',
    'Дата',
  ].join(',')

  const rows = submissions.map((s) => {
    const cols = [
      `"${(s.participant_name ?? '').replace(/"/g, '""')}"`,
      `"${(s.team_name ?? '').replace(/"/g, '""')}"`,
      `"${(s.case_title ?? '').replace(/"/g, '""')}"`,
      s.scores.analytics ?? '',
      s.scores.idea ?? '',
      s.scores.steps ?? '',
      s.scores.budget ?? '',
      s.scores.presentation ?? '',
      s.total ?? '',
      STATUS_LABELS[s.status] ?? s.status,
      s.created_at ? formatDate(s.created_at) : '',
    ]
    return cols.join(',')
  })

  const csv = '\uFEFF' + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DashboardPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/results')
        if (!res.ok) throw new Error('Ошибка загрузки')
        const json = await res.json()
        setSubmissions(json.data ?? [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter
  let filtered = submissions
  if (statusFilter !== 'all') {
    filtered = filtered.filter((s) => s.status === statusFilter)
  }
  if (search.trim()) {
    const q = search.toLowerCase().trim()
    filtered = filtered.filter(
      (s) =>
        (s.participant_name ?? '').toLowerCase().includes(q) ||
        (s.team_name ?? '').toLowerCase().includes(q)
    )
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'total') {
      cmp = (a.total ?? -1) - (b.total ?? -1)
    } else {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return sortAsc ? cmp : -cmp
  })

  // Stats
  const totalCount = submissions.length
  const avgScore =
    submissions.filter((s) => s.total !== null).length > 0
      ? Math.round(
          submissions.filter((s) => s.total !== null).reduce((acc, s) => acc + (s.total ?? 0), 0) /
            submissions.filter((s) => s.total !== null).length
        )
      : 0
  const reviewCount = submissions.filter((s) => s.needs_review).length

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase text-orange mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
          Дашборд куратора
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Все <span className="text-orange">работы</span>
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray2 p-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Всего работ</p>
          <p className="text-3xl font-black text-dark">{totalCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray2 p-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Средний балл</p>
          <p className="text-3xl font-black text-dark">
            {avgScore}
            <span className="text-lg font-bold text-muted">/200</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray2 p-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Требуют проверки</p>
          <p className="text-3xl font-black text-orange">{reviewCount}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по имени или команде…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray2 bg-white text-sm font-medium text-dark placeholder:text-muted/60 focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 bg-gray rounded-xl p-1 border border-gray2">
          {(['all', 'pending', 'checking', 'done', 'review', 'error'] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-orange text-white shadow-sm'
                    : 'text-muted hover:text-dark hover:bg-white'
                }`}
              >
                {s === 'all' ? 'Все' : STATUS_LABELS[s]}
              </button>
            )
          )}
        </div>

        {/* Export CSV */}
        <button
          onClick={() => exportCSV(filtered)}
          className="inline-flex items-center gap-2 border-2 border-dark text-dark px-4 py-2 rounded-xl text-xs font-bold hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Экспорт CSV
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-orange" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray2 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray border-b border-gray2">
                <tr>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">
                    Имя
                  </th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">
                    Команда
                  </th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">
                    Кейс
                  </th>
                  {SECTION_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="text-center px-2 py-3 font-extrabold text-dark text-xs uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                  <th
                    className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider cursor-pointer select-none hover:text-orange transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    Итого{sortArrow('total')}
                  </th>
                  <th className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">
                    Статус
                  </th>
                  <th
                    className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider cursor-pointer select-none hover:text-orange transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    Дата{sortArrow('date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center py-16 text-muted text-sm font-medium"
                    >
                      Нет работ
                    </td>
                  </tr>
                )}
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => router.push(`/results/${sub.id}`)}
                    className={`border-b border-gray2 last:border-b-0 cursor-pointer hover:bg-orange-pale/40 transition-colors ${
                      sub.needs_review ? 'border-l-4 border-l-orange' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-dark whitespace-nowrap max-w-[180px] truncate">
                      {sub.participant_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap max-w-[140px] truncate">
                      {sub.team_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-dark whitespace-nowrap max-w-[160px] truncate">
                      {sub.case_title}
                    </td>
                    {SECTIONS.map((sec) => {
                      const score = sub.scores[sec]
                      return (
                        <td key={sec} className="text-center px-2 py-3">
                          {score !== undefined && score !== null ? (
                            <span
                              className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${scoreColorClass(
                                score
                              )}`}
                            >
                              {score}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center px-4 py-3">
                      {sub.total !== null ? (
                        <span className="text-sm font-black text-dark">{sub.total}</span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                          STATUS_COLORS[sub.status] ?? 'bg-gray text-muted border-gray2'
                        }`}
                      >
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {sub.created_at ? formatDate(sub.created_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
