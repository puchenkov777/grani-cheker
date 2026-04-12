'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Submission {
  id: string
  case_title: string
  status: string
  created_at: string
  participant_name: string | null
  participant_email: string | null
  team_name: string | null
  mentor: string | null
  total: number | null
  grade: string | null
  needs_review: boolean
  scores: Record<string, number>
  section_analytics: string | null
  section_idea: string | null
  section_steps: string | null
  section_budget: string | null
  pptx_file_path: string | null
  idea_attachment_path: string | null
  steps_attachment_path: string | null
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

const SECTIONS = ['analytics', 'idea', 'steps', 'budget', 'presentation', 'cross_validation'] as const
const SECTION_LABELS: Record<string, string> = {
  analytics: 'Аналитика',
  idea: 'Идея',
  steps: 'Шаги',
  budget: 'Бюджет',
  presentation: 'Презентация',
  cross_validation: 'Связанность',
}

function scoreColorClass(score: number | undefined, section?: string): string {
  if (score === undefined || score === null) return 'text-muted'
  if (section === 'cross_validation') {
    if (score === 0) return 'bg-red-100 text-red-600'
    if (score === 1) return 'bg-orange-100 text-orange'
    if (score === 2) return 'bg-yellow-100 text-yellow-700'
    if (score === 3) return 'bg-lime-100 text-lime-700'
    if (score === 4) return 'bg-emerald-100 text-emerald-700'
    return 'text-muted'
  }
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
    'Ментор',
    'Кейс',
    'Аналитика',
    'Идея',
    'Шаги',
    'Бюджет',
    'Покажи что получилось',
    'Связанность',
    'Итого',
    'Статус',
    'Дата',
  ].join(',')

  const rows = submissions.map((s) => {
    const cols = [
      `"${(s.participant_name ?? '').replace(/"/g, '""')}"`,
      `"${(s.mentor ?? '').replace(/"/g, '""')}"`,
      `"${(s.case_title ?? '').replace(/"/g, '""')}"`,
      s.scores.analytics ?? '',
      s.scores.idea ?? '',
      s.scores.steps ?? '',
      s.scores.budget ?? '',
      s.scores.presentation ?? '',
      s.scores.cross_validation ?? '',
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
  const [authed, setAuthed] = useState(false)
  const [mentorName, setMentorName] = useState('')
  const [mentorDisplayName, setMentorDisplayName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<Submission | null>(null)
  const [detailScores, setDetailScores] = useState<Array<{section: string, score: number, reasoning: string, strengths: string[], weaknesses: string[]}>>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCase, setShowCase] = useState(false)

  // Check auth
  useEffect(() => {
    const auth = localStorage.getItem('mentor_auth')
    if (!auth) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(auth)
      if (parsed.name && parsed.ts && parsed.role !== 'admin') {
        setMentorName(parsed.name)
        setMentorDisplayName(parsed.displayName || parsed.name)
        setAuthed(true)
      } else if (parsed.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!authed) return
    async function fetchData() {
      try {
        const res = await fetch('/api/results')
        if (!res.ok) throw new Error('Ошибка загрузки')
        const json = await res.json()
        const mentorMap: Record<string, string> = { victor: 'Виктор', vlad: 'Влад' }
        const displayMentor = mentorMap[mentorName] || mentorName
        const filtered = (json.data ?? []).filter((s: Submission) =>
          s.mentor === displayMentor || s.mentor === mentorName
        )
        setSubmissions(filtered)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [authed, mentorName])

  const handleDownloadFile = useCallback(async (filePath: string, label: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('submissions')
        .download(filePath)
      if (error || !data) {
        alert('Ошибка скачивания файла')
        return
      }
      const ext = filePath.split('.').pop() || 'bin'
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Ошибка скачивания файла')
    }
  }, [])

  const openDetail = useCallback(async (sub: Submission) => {
    setSelectedId(sub.id)
    setSelectedDetail(sub)
    setDetailLoading(true)
    try {
      const { data } = await supabase
        .from('scores')
        .select('section, score, reasoning, strengths, weaknesses')
        .eq('submission_id', sub.id)
        .eq('run_number', 1)
        .order('section')
      setDetailScores(data ?? [])
    } catch {
      setDetailScores([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleDownloadDocx = useCallback(async () => {
    if (!selectedDetail) return
    const { exportToDocx } = await import('@/lib/export-docx')

    let facts = [{ fact: '', conclusion: '', source: '' }]
    let generalConclusion = ''
    let ideaFields = { name: '', concept: '', audience: '', how_it_works: '', benefit: '' }
    let steps = [{ step: '', timeframe: '', expected_result: '' }]
    let resources = [{ resource: '', cost: '', source: '' }]

    try {
      if (selectedDetail.section_analytics) {
        const a = JSON.parse(selectedDetail.section_analytics)
        if (a.facts) facts = a.facts
        if (a.general_conclusion) generalConclusion = a.general_conclusion
      }
    } catch { /* raw text fallback */ }

    try {
      if (selectedDetail.section_idea) {
        ideaFields = JSON.parse(selectedDetail.section_idea)
      }
    } catch { /* raw text */ }

    try {
      if (selectedDetail.section_steps) {
        steps = JSON.parse(selectedDetail.section_steps)
      }
    } catch { /* raw text */ }

    try {
      if (selectedDetail.section_budget) {
        resources = JSON.parse(selectedDetail.section_budget)
      }
    } catch { /* raw text */ }

    await exportToDocx({
      name: selectedDetail.participant_name || '—',
      mentor: '',
      caseTitle: selectedDetail.case_title || '—',
      facts,
      generalConclusion,
      ideaFields,
      steps,
      resources,
    })
  }, [selectedDetail])

  function renderCaseSection(title: string, raw: string | null) {
    if (!raw) return (
      <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
        <p className="text-xs font-bold text-muted mb-1">{title}</p>
        <p className="text-xs text-muted italic">Не заполнено</p>
      </div>
    )

    try {
      const parsed = JSON.parse(raw)

      if (parsed.facts && Array.isArray(parsed.facts)) {
        const filledFacts = parsed.facts.filter((f: { fact: string }) => f.fact?.trim())
        return (
          <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
            <p className="text-xs font-bold text-dark mb-2">{title}</p>
            {filledFacts.map((f: { fact: string; conclusion: string; source: string }, i: number) => (
              <div key={i} className="mb-2 pl-3 border-l-2 border-orange/30">
                <p className="text-xs text-dark"><span className="font-bold text-orange">Факт {i + 1}:</span> {f.fact}</p>
                {f.conclusion && <p className="text-xs text-muted">Вывод: {f.conclusion}</p>}
                {f.source && <p className="text-xs text-muted">Источник: {f.source}</p>}
              </div>
            ))}
            {parsed.general_conclusion && (
              <div className="mt-2 pt-2 border-t border-gray2">
                <p className="text-xs font-bold text-dark">Общий вывод:</p>
                <p className="text-xs text-dark">{parsed.general_conclusion}</p>
              </div>
            )}
          </div>
        )
      }

      if (parsed.name !== undefined && parsed.concept !== undefined) {
        return (
          <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
            <p className="text-xs font-bold text-dark mb-2">{title}</p>
            {parsed.name && <p className="text-xs mb-1"><span className="font-bold">Название:</span> {parsed.name}</p>}
            {parsed.concept && <p className="text-xs mb-1"><span className="font-bold">Концепция:</span> {parsed.concept}</p>}
            {parsed.audience && <p className="text-xs mb-1"><span className="font-bold">ЦА:</span> {parsed.audience}</p>}
            {parsed.how_it_works && <p className="text-xs mb-1"><span className="font-bold">Как работает:</span> {parsed.how_it_works}</p>}
            {parsed.benefit && <p className="text-xs mb-1"><span className="font-bold">Польза:</span> {parsed.benefit}</p>}
          </div>
        )
      }

      if (Array.isArray(parsed) && parsed[0]?.step !== undefined) {
        const filledSteps = parsed.filter((s: { step: string }) => s.step?.trim())
        return (
          <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
            <p className="text-xs font-bold text-dark mb-2">{title}</p>
            {filledSteps.map((s: { step: string; timeframe: string; expected_result: string }, i: number) => (
              <div key={i} className="mb-2 pl-3 border-l-2 border-orange/30">
                <p className="text-xs text-dark"><span className="font-bold text-orange">Шаг {i + 1}:</span> {s.step}</p>
                {s.timeframe && <p className="text-xs text-muted">Время: {s.timeframe}</p>}
                {s.expected_result && <p className="text-xs text-muted">Результат: {s.expected_result}</p>}
              </div>
            ))}
          </div>
        )
      }

      if (Array.isArray(parsed) && parsed[0]?.resource !== undefined) {
        const filledRes = parsed.filter((r: { resource: string }) => r.resource?.trim())
        return (
          <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
            <p className="text-xs font-bold text-dark mb-2">{title}</p>
            {filledRes.map((r: { resource: string; cost: string; source: string }, i: number) => (
              <div key={i} className="mb-1.5 text-xs">
                <span className="font-bold text-dark">{r.resource}</span>
                <span className="text-muted ml-2">{r.cost}</span>
                {r.source && <span className="text-muted ml-2 break-all">{r.source}</span>}
              </div>
            ))}
          </div>
        )
      }
    } catch {
      // Not JSON — render as plain text
    }

    return (
      <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
        <p className="text-xs font-bold text-dark mb-1">{title}</p>
        <p className="text-xs text-dark whitespace-pre-wrap leading-relaxed">{raw}</p>
      </div>
    )
  }

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
        (s.case_title ?? '').toLowerCase().includes(q)
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-end justify-between flex-wrap gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-orange mb-3 sm:mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            Дашборд ментора
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
            Работы для <span className="text-orange">{mentorDisplayName}</span>
          </h1>
        </div>
        <button
          onClick={() => { localStorage.removeItem('mentor_auth'); router.push('/login'); }}
          className="text-xs font-bold text-muted hover:text-orange transition-colors"
        >
          Выйти
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Всего работ</p>
          <p className="text-xl sm:text-3xl font-black text-dark">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Средний балл</p>
          <p className="text-xl sm:text-3xl font-black text-dark">
            {avgScore}
            <span className="text-sm sm:text-lg font-bold text-muted">/200</span>
          </p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Требуют проверки</p>
          <p className="text-xl sm:text-3xl font-black text-orange">{reviewCount}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
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
            placeholder="Поиск по имени или кейсу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray2 bg-white text-sm font-medium text-dark placeholder:text-muted/60 focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-gray rounded-xl p-1 border border-gray2 overflow-x-auto">
          {(['all', 'pending', 'checking', 'done', 'review', 'error'] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
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

        {/* Sort + Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSort('total')}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${sortKey === 'total' ? 'border-orange text-orange bg-orange-pale' : 'border-gray2 text-muted hover:border-orange hover:text-orange'}`}
          >
            Балл{sortArrow('total')}
          </button>
          <button
            onClick={() => handleSort('date')}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all ${sortKey === 'date' ? 'border-orange text-orange bg-orange-pale' : 'border-gray2 text-muted hover:border-orange hover:text-orange'}`}
          >
            Дата{sortArrow('date')}
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            className="inline-flex items-center gap-1.5 border-2 border-dark text-dark px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Экспорт</span> CSV
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-orange" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 sm:px-6 py-4 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Mobile cards */}
      {!loading && !error && (
        <div className="block lg:hidden space-y-3">
          {filtered.length === 0 && (
            <p className="text-center py-16 text-muted text-sm font-medium">Нет работ</p>
          )}
          {filtered.map((sub) => (
            <div
              key={sub.id}
              onClick={() => openDetail(sub)}
              className={`bg-white rounded-xl border border-gray2 p-4 cursor-pointer hover:bg-orange-pale/40 transition-colors ${
                sub.needs_review ? 'border-l-4 border-l-orange' : ''
              } ${selectedId === sub.id ? 'bg-orange-pale/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-dark truncate">{sub.participant_name ?? '—'}</p>
                  <p className="text-xs text-muted truncate">{sub.case_title}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[sub.status] ?? 'bg-gray text-muted border-gray2'}`}>
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-orange">{sub.mentor ?? '—'}</span>
                <span className="text-[10px] text-muted">{sub.created_at ? formatDate(sub.created_at) : '—'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {SECTIONS.map((sec) => {
                  const score = sub.scores[sec]
                  return (
                    <div key={sec} className="flex items-center gap-1">
                      <span className="text-[9px] text-muted">{SECTION_LABELS[sec]?.slice(0, 3)}</span>
                      {score !== undefined && score !== null ? (
                        <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold ${scoreColorClass(score, sec)}`}>
                          {score}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">—</span>
                      )}
                    </div>
                  )
                })}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] font-bold text-muted">Итого:</span>
                  <span className="text-sm font-black text-dark">{sub.total ?? '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && !error && (
        <div className="hidden lg:block bg-white rounded-2xl border border-gray2 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray border-b border-gray2">
                <tr>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Имя</th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Ментор</th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Кейс</th>
                  {SECTIONS.map((sec) => (
                    <th key={sec} className="text-center px-2 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">
                      {SECTION_LABELS[sec]}
                    </th>
                  ))}
                  <th
                    className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider cursor-pointer select-none hover:text-orange transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    Итого{sortArrow('total')}
                  </th>
                  <th className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Статус</th>
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
                    <td colSpan={12} className="text-center py-16 text-muted text-sm font-medium">Нет работ</td>
                  </tr>
                )}
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => openDetail(sub)}
                    className={`border-b border-gray2 last:border-b-0 cursor-pointer hover:bg-orange-pale/40 transition-colors ${
                      sub.needs_review ? 'border-l-4 border-l-orange' : ''
                    } ${selectedId === sub.id ? 'bg-orange-pale/30' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-dark whitespace-nowrap max-w-[180px] truncate">{sub.participant_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-orange whitespace-nowrap">{sub.mentor ?? '—'}</td>
                    <td className="px-4 py-3 text-dark whitespace-nowrap max-w-[160px] truncate">{sub.case_title}</td>
                    {SECTIONS.map((sec) => {
                      const score = sub.scores[sec]
                      return (
                        <td key={sec} className="text-center px-2 py-3">
                          {score !== undefined && score !== null ? (
                            <span className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${scoreColorClass(score, sec)}`}>
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border ${STATUS_COLORS[sub.status] ?? 'bg-gray text-muted border-gray2'}`}>
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{sub.created_at ? formatDate(sub.created_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedId && selectedDetail && (
        <div className="mt-6 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-gray2 shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black truncate">
                {selectedDetail.participant_name ?? '—'}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Ментор: <span className="font-bold text-orange">{selectedDetail.mentor ?? '—'}</span> &middot; Кейс: {selectedDetail.case_title} &middot; Итого: <span className="font-bold text-dark">{selectedDetail.total ?? '—'}/200</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={handleDownloadDocx}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold border border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                .docx
              </button>
              <button
                onClick={() => setShowCase(!showCase)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold border transition-all ${showCase ? 'border-orange text-orange bg-orange-pale' : 'border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale'}`}
              >
                {showCase ? 'Скрыть кейс' : 'Показать кейс'}
              </button>
              <button
                onClick={() => { setSelectedId(null); setSelectedDetail(null); setDetailScores([]); setShowCase(false); }}
                className="text-muted hover:text-dark text-xl font-bold transition-colors"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Submitted case content */}
          {showCase && (
            <div className="mb-6 space-y-3 sm:space-y-4">
              <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-orange flex items-center gap-2">
                <span className="w-4 h-0.5 bg-orange" />
                Отправленный кейс
              </div>
              {renderCaseSection('Аналитика', selectedDetail.section_analytics)}
              {renderCaseSection('Идея', selectedDetail.section_idea)}
              {renderCaseSection('Шаги', selectedDetail.section_steps)}
              {renderCaseSection('Бюджет', selectedDetail.section_budget)}

              {(selectedDetail.pptx_file_path || selectedDetail.idea_attachment_path || selectedDetail.steps_attachment_path) && (
                <div className="bg-gray rounded-xl p-3 sm:p-4 border border-gray2">
                  <p className="text-xs font-bold text-dark mb-3">Прикреплённые файлы</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDetail.pptx_file_path && (
                      <button
                        onClick={() => handleDownloadFile(selectedDetail.pptx_file_path!, `${selectedDetail.participant_name || 'участник'}_презентация`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Презентация
                      </button>
                    )}
                    {selectedDetail.idea_attachment_path && (
                      <button
                        onClick={() => handleDownloadFile(selectedDetail.idea_attachment_path!, `${selectedDetail.participant_name || 'участник'}_идея`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Файл (Идея)
                      </button>
                    )}
                    {selectedDetail.steps_attachment_path && (
                      <button
                        onClick={() => handleDownloadFile(selectedDetail.steps_attachment_path!, `${selectedDetail.participant_name || 'участник'}_шаги`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Файл (Шаги)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Scores */}
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-orange" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : detailScores.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Результаты проверки ещё не готовы</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {detailScores.map((s) => {
                const sectionNames: Record<string, string> = {
                  analytics: 'Аналитика',
                  idea: 'Идея',
                  steps: 'Шаги',
                  budget: 'Бюджет',
                  presentation: 'Покажи что получилось',
                  cross_validation: 'Связанность',
                }
                const isCross = s.section === 'cross_validation'
                const maxScore = isCross ? 4 : 40
                const barColor = isCross
                  ? (s.score >= 3 ? 'bg-emerald-500' : s.score >= 2 ? 'bg-yellow-400' : s.score >= 1 ? 'bg-orange' : 'bg-red-500')
                  : (s.score >= 30 ? 'bg-emerald-500' : s.score >= 20 ? 'bg-yellow-400' : s.score >= 10 ? 'bg-orange' : 'bg-red-500')
                return (
                  <div key={s.section} className="bg-gray rounded-xl p-4 sm:p-5 border border-gray2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs sm:text-sm font-extrabold">{sectionNames[s.section] ?? s.section}</span>
                      <span className="text-base sm:text-lg font-black">{s.score}<span className="text-xs sm:text-sm font-bold text-muted">/{maxScore}</span></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray2 overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max((s.score / maxScore) * 100, 2)}%` }} />
                    </div>
                    {s.reasoning && (
                      <p className="text-xs text-dark leading-relaxed mb-2">{s.reasoning}</p>
                    )}
                    {(s.strengths as string[])?.length > 0 && (
                      <div className="mb-2">
                        {(s.strengths as string[]).map((str, i) => (
                          <p key={i} className="text-xs text-emerald-600 flex items-start gap-1.5"><span className="mt-0.5">+</span>{str}</p>
                        ))}
                      </div>
                    )}
                    {(s.weaknesses as string[])?.length > 0 && (
                      <div>
                        {(s.weaknesses as string[]).map((w, i) => (
                          <p key={i} className="text-xs text-red-500 flex items-start gap-1.5"><span className="mt-0.5">-</span>{w}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
