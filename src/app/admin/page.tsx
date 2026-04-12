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
  pending: 'В очереди', checking: 'Проверяется', done: 'Проверено', review: 'На проверке', error: 'Ошибка',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  checking: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  review: 'bg-orange-pale text-orange border-orange/30',
  error: 'bg-red-100 text-red-600 border-red-300',
}
const SECTIONS = ['analytics', 'idea', 'steps', 'budget', 'presentation', 'cross_validation'] as const
const SECTION_HEADERS = ['Аналитика', 'Идея', 'Шаги', 'Бюджет', 'Покажи что получилось', 'Связанность']

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
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function exportCSV(submissions: Submission[]) {
  const header = ['Имя','Ментор','Кейс','Аналитика','Идея','Шаги','Бюджет','Покажи что получилось','Связанность','Итого','Статус','Дата'].join(',')
  const rows = submissions.map((s) => [
    `"${(s.participant_name ?? '').replace(/"/g, '""')}"`,
    `"${(s.mentor ?? '').replace(/"/g, '""')}"`,
    `"${(s.case_title ?? '').replace(/"/g, '""')}"`,
    s.scores.analytics ?? '', s.scores.idea ?? '', s.scores.steps ?? '', s.scores.budget ?? '',
    s.scores.presentation ?? '', s.scores.cross_validation ?? '', s.total ?? '',
    STATUS_LABELS[s.status] ?? s.status, s.created_at ? formatDate(s.created_at) : '',
  ].join(','))
  const csv = '\uFEFF' + header + '\n' + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `admin-all-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [mentorFilter, setMentorFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')
  const [authed, setAuthed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<Submission | null>(null)
  const [detailScores, setDetailScores] = useState<Array<{section: string, score: number, reasoning: string, strengths: string[], weaknesses: string[]}>>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCase, setShowCase] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('mentor_auth')
    if (!auth) { router.push('/login'); return }
    try {
      const parsed = JSON.parse(auth)
      if (parsed.role === 'admin') { setAuthed(true) }
      else { router.push('/dashboard') }
    } catch { router.push('/login') }
  }, [router])

  useEffect(() => {
    if (!authed) return
    async function fetchData() {
      try {
        const res = await fetch('/api/results')
        if (!res.ok) throw new Error('Ошибка загрузки')
        const json = await res.json()
        setSubmissions(json.data ?? [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      } finally { setLoading(false) }
    }
    fetchData()
  }, [authed])

  const handleDownloadFile = useCallback(async (filePath: string, label: string) => {
    try {
      const { data, error } = await supabase.storage.from('submissions').download(filePath)
      if (error || !data) { alert('Ошибка скачивания'); return }
      const ext = filePath.split('.').pop() || 'bin'
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = `${label}.${ext}`; a.click(); URL.revokeObjectURL(url)
    } catch { alert('Ошибка скачивания') }
  }, [])

  const openDetail = useCallback(async (sub: Submission) => {
    setSelectedId(sub.id); setSelectedDetail(sub); setDetailLoading(true); setShowCase(false)
    try {
      const { data } = await supabase.from('scores').select('section, score, reasoning, strengths, weaknesses')
        .eq('submission_id', sub.id).eq('run_number', 1).order('section')
      setDetailScores(data ?? [])
    } catch { setDetailScores([]) }
    finally { setDetailLoading(false) }
  }, [])

  const handleDownloadDocx = useCallback(async () => {
    if (!selectedDetail) return
    const { exportToDocx } = await import('@/lib/export-docx')
    let facts = [{ fact: '', conclusion: '', source: '' }]
    let generalConclusion = ''
    let ideaFields = { name: '', concept: '', audience: '', how_it_works: '', benefit: '' }
    let steps = [{ step: '', timeframe: '', expected_result: '' }]
    let resources = [{ resource: '', cost: '', source: '' }]
    try { if (selectedDetail.section_analytics) { const a = JSON.parse(selectedDetail.section_analytics); if (a.facts) facts = a.facts; if (a.general_conclusion) generalConclusion = a.general_conclusion } } catch {}
    try { if (selectedDetail.section_idea) ideaFields = JSON.parse(selectedDetail.section_idea) } catch {}
    try { if (selectedDetail.section_steps) steps = JSON.parse(selectedDetail.section_steps) } catch {}
    try { if (selectedDetail.section_budget) resources = JSON.parse(selectedDetail.section_budget) } catch {}
    await exportToDocx({ name: selectedDetail.participant_name || '—', mentor: selectedDetail.mentor || '', caseTitle: selectedDetail.case_title || '—', facts, generalConclusion, ideaFields, steps, resources })
  }, [selectedDetail])

  function renderCaseSection(title: string, raw: string | null) {
    if (!raw) return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-muted mb-1">{title}</p><p className="text-xs text-muted italic">Не заполнено</p></div>
    try {
      const parsed = JSON.parse(raw)
      if (parsed.facts && Array.isArray(parsed.facts)) {
        const ff = parsed.facts.filter((f: {fact:string}) => f.fact?.trim())
        return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-dark mb-2">{title}</p>{ff.map((f: {fact:string,conclusion:string,source:string}, i: number) => <div key={i} className="mb-2 pl-3 border-l-2 border-orange/30"><p className="text-xs text-dark"><span className="font-bold text-orange">Факт {i+1}:</span> {f.fact}</p>{f.conclusion && <p className="text-xs text-muted">Вывод: {f.conclusion}</p>}{f.source && <p className="text-xs text-muted">Источник: {f.source}</p>}</div>)}{parsed.general_conclusion && <div className="mt-2 pt-2 border-t border-gray2"><p className="text-xs font-bold text-dark">Общий вывод:</p><p className="text-xs text-dark">{parsed.general_conclusion}</p></div>}</div>
      }
      if (parsed.name !== undefined && parsed.concept !== undefined) {
        return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-dark mb-2">{title}</p>{parsed.name && <p className="text-xs mb-1"><span className="font-bold">Название:</span> {parsed.name}</p>}{parsed.concept && <p className="text-xs mb-1"><span className="font-bold">Концепция:</span> {parsed.concept}</p>}{parsed.audience && <p className="text-xs mb-1"><span className="font-bold">ЦА:</span> {parsed.audience}</p>}{parsed.how_it_works && <p className="text-xs mb-1"><span className="font-bold">Как работает:</span> {parsed.how_it_works}</p>}{parsed.benefit && <p className="text-xs mb-1"><span className="font-bold">Польза:</span> {parsed.benefit}</p>}</div>
      }
      if (Array.isArray(parsed) && parsed[0]?.step !== undefined) {
        const fs = parsed.filter((s: {step:string}) => s.step?.trim())
        return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-dark mb-2">{title}</p>{fs.map((s: {step:string,timeframe:string,expected_result:string}, i: number) => <div key={i} className="mb-2 pl-3 border-l-2 border-orange/30"><p className="text-xs text-dark"><span className="font-bold text-orange">Шаг {i+1}:</span> {s.step}</p>{s.timeframe && <p className="text-xs text-muted">Время: {s.timeframe}</p>}{s.expected_result && <p className="text-xs text-muted">Результат: {s.expected_result}</p>}</div>)}</div>
      }
      if (Array.isArray(parsed) && parsed[0]?.resource !== undefined) {
        const fr = parsed.filter((r: {resource:string}) => r.resource?.trim())
        return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-dark mb-2">{title}</p>{fr.map((r: {resource:string,cost:string,source:string}, i: number) => <div key={i} className="mb-1 flex gap-3 text-xs"><span className="font-bold text-dark">{r.resource}</span><span className="text-muted">{r.cost}</span>{r.source && <span className="text-muted truncate max-w-[200px]">{r.source}</span>}</div>)}</div>
      }
    } catch {}
    return <div className="bg-gray rounded-xl p-4 border border-gray2"><p className="text-xs font-bold text-dark mb-1">{title}</p><p className="text-xs text-dark whitespace-pre-wrap leading-relaxed">{raw}</p></div>
  }

  // Get unique mentors for filter
  const mentors = Array.from(new Set(submissions.map(s => s.mentor).filter(Boolean))) as string[]

  let filtered = submissions
  if (statusFilter !== 'all') filtered = filtered.filter(s => s.status === statusFilter)
  if (mentorFilter !== 'all') filtered = filtered.filter(s => s.mentor === mentorFilter)
  if (search.trim()) {
    const q = search.toLowerCase().trim()
    filtered = filtered.filter(s => (s.participant_name ?? '').toLowerCase().includes(q) || (s.case_title ?? '').toLowerCase().includes(q))
  }
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortKey === 'total' ? (a.total ?? -1) - (b.total ?? -1) : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortAsc ? cmp : -cmp
  })

  const totalCount = submissions.length
  const avgScore = submissions.filter(s => s.total !== null).length > 0
    ? Math.round(submissions.filter(s => s.total !== null).reduce((a, s) => a + (s.total ?? 0), 0) / submissions.filter(s => s.total !== null).length) : 0
  const reviewCount = submissions.filter(s => s.needs_review).length

  function handleSort(key: SortKey) { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(false) } }
  const sortArrow = (key: SortKey) => sortKey !== key ? '' : sortAsc ? ' ↑' : ' ↓'

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8 flex items-end justify-between flex-wrap gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-red-600 mb-3 sm:mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Панель администратора
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
            Все <span className="text-orange">работы</span>
          </h1>
        </div>
        <button onClick={() => { localStorage.removeItem('mentor_auth'); router.push('/login') }} className="text-xs font-bold text-muted hover:text-orange transition-colors">Выйти</button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Всего работ</p>
          <p className="text-xl sm:text-3xl font-black text-dark">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Средний балл</p>
          <p className="text-xl sm:text-3xl font-black text-dark">{avgScore}<span className="text-sm sm:text-lg font-bold text-muted">/200</span></p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray2 p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-1">Требуют проверки</p>
          <p className="text-xl sm:text-3xl font-black text-orange">{reviewCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Поиск по имени или кейсу…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray2 bg-white text-sm font-medium text-dark placeholder:text-muted/60 focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-colors" />
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 bg-gray rounded-xl p-1 border border-gray2 overflow-x-auto">
          <button onClick={() => setMentorFilter('all')} className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${mentorFilter === 'all' ? 'bg-orange text-white shadow-sm' : 'text-muted hover:text-dark hover:bg-white'}`}>Все менторы</button>
          {mentors.map(m => (
            <button key={m} onClick={() => setMentorFilter(m)} className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${mentorFilter === m ? 'bg-orange text-white shadow-sm' : 'text-muted hover:text-dark hover:bg-white'}`}>{m}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 bg-gray rounded-xl p-1 border border-gray2 overflow-x-auto">
          {(['all','pending','checking','done','review','error'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${statusFilter === s ? 'bg-orange text-white shadow-sm' : 'text-muted hover:text-dark hover:bg-white'}`}>{s === 'all' ? 'Все' : STATUS_LABELS[s]}</button>
          ))}
        </div>

        <button onClick={() => exportCSV(filtered)} className="inline-flex items-center gap-1.5 border-2 border-dark text-dark px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold hover:border-orange hover:text-orange hover:bg-orange-pale transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Экспорт CSV
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><svg className="animate-spin h-8 w-8 text-orange" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm text-red-600 font-medium">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray2 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray border-b border-gray2">
                <tr>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Имя</th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Ментор</th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Кейс</th>
                  {SECTION_HEADERS.map(h => <th key={h} className="text-center px-2 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">{h}</th>)}
                  <th className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider cursor-pointer select-none hover:text-orange transition-colors" onClick={() => handleSort('total')}>Итого{sortArrow('total')}</th>
                  <th className="text-center px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider">Статус</th>
                  <th className="text-left px-4 py-3 font-extrabold text-dark text-xs uppercase tracking-wider cursor-pointer select-none hover:text-orange transition-colors" onClick={() => handleSort('date')}>Дата{sortArrow('date')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={12} className="text-center py-16 text-muted text-sm font-medium">Нет работ</td></tr>}
                {filtered.map(sub => (
                  <tr key={sub.id} onClick={() => openDetail(sub)}
                    className={`border-b border-gray2 last:border-b-0 cursor-pointer hover:bg-orange-pale/40 transition-colors ${sub.needs_review ? 'border-l-4 border-l-orange' : ''} ${selectedId === sub.id ? 'bg-orange-pale/30' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-dark whitespace-nowrap max-w-[180px] truncate">{sub.participant_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-orange whitespace-nowrap">{sub.mentor ?? '—'}</td>
                    <td className="px-4 py-3 text-dark whitespace-nowrap max-w-[160px] truncate">{sub.case_title}</td>
                    {SECTIONS.map(sec => {
                      const score = sub.scores[sec]
                      return <td key={sec} className="text-center px-2 py-3">{score !== undefined && score !== null ? <span className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${scoreColorClass(score, sec)}`}>{score}</span> : <span className="text-muted text-xs">—</span>}</td>
                    })}
                    <td className="text-center px-4 py-3">{sub.total !== null ? <span className="text-sm font-black text-dark">{sub.total}</span> : <span className="text-muted text-xs">—</span>}</td>
                    <td className="text-center px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border ${STATUS_COLORS[sub.status] ?? 'bg-gray text-muted border-gray2'}`}>{STATUS_LABELS[sub.status] ?? sub.status}</span></td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{sub.created_at ? formatDate(sub.created_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && selectedDetail && (
        <div className="mt-6 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-gray2 shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black truncate">{selectedDetail.participant_name ?? '—'}</h3>
              <p className="text-xs text-muted mt-0.5">Ментор: <span className="font-bold text-orange">{selectedDetail.mentor ?? '—'}</span> &middot; Кейс: {selectedDetail.case_title} &middot; Итого: <span className="font-bold text-dark">{selectedDetail.total ?? '—'}/200</span></p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button onClick={handleDownloadDocx} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold border border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                .docx
              </button>
              <button onClick={() => setShowCase(!showCase)} className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold border transition-all ${showCase ? 'border-orange text-orange bg-orange-pale' : 'border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale'}`}>{showCase ? 'Скрыть кейс' : 'Показать кейс'}</button>
              <button onClick={() => { setSelectedId(null); setSelectedDetail(null); setDetailScores([]); setShowCase(false) }} className="text-muted hover:text-dark text-xl font-bold transition-colors">&times;</button>
            </div>
          </div>

          {showCase && (
            <div className="mb-6 space-y-4">
              <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-orange flex items-center gap-2"><span className="w-4 h-0.5 bg-orange" />Отправленный кейс</div>
              {renderCaseSection('🔍 Аналитика', selectedDetail.section_analytics)}
              {renderCaseSection('💡 Идея', selectedDetail.section_idea)}
              {renderCaseSection('📋 Шаги', selectedDetail.section_steps)}
              {renderCaseSection('💰 Бюджет', selectedDetail.section_budget)}
              {(selectedDetail.pptx_file_path || selectedDetail.idea_attachment_path || selectedDetail.steps_attachment_path) && (
                <div className="bg-gray rounded-xl p-4 border border-gray2">
                  <p className="text-xs font-bold text-dark mb-3">📎 Прикреплённые файлы</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDetail.pptx_file_path && <button onClick={() => handleDownloadFile(selectedDetail.pptx_file_path!, `${selectedDetail.participant_name || 'участник'}_презентация`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Презентация</button>}
                    {selectedDetail.idea_attachment_path && <button onClick={() => handleDownloadFile(selectedDetail.idea_attachment_path!, `${selectedDetail.participant_name || 'участник'}_идея`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Доп. файл (Идея)</button>}
                    {selectedDetail.steps_attachment_path && <button onClick={() => handleDownloadFile(selectedDetail.steps_attachment_path!, `${selectedDetail.participant_name || 'участник'}_шаги`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray2 bg-white text-dark hover:border-orange hover:text-orange transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Доп. файл (Шаги)</button>}
                  </div>
                </div>
              )}
            </div>
          )}

          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><svg className="animate-spin h-6 w-6 text-orange" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
          ) : detailScores.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Результаты проверки ещё не готовы</p>
          ) : (
            <div className="space-y-4">
              {detailScores.map(s => {
                const names: Record<string,string> = { analytics:'🔍 Аналитика', idea:'💡 Идея', steps:'📋 Шаги', budget:'💰 Бюджет', presentation:'📊 Покажи что получилось', cross_validation:'🔗 Связанность' }
                const isCross = s.section === 'cross_validation'
                const maxScore = isCross ? 4 : 40
                const bar = isCross
                  ? (s.score >= 3 ? 'bg-emerald-500' : s.score >= 2 ? 'bg-yellow-400' : s.score >= 1 ? 'bg-orange' : 'bg-red-500')
                  : (s.score >= 30 ? 'bg-emerald-500' : s.score >= 20 ? 'bg-yellow-400' : s.score >= 10 ? 'bg-orange' : 'bg-red-500')
                return (
                  <div key={s.section} className="bg-gray rounded-xl p-5 border border-gray2">
                    <div className="flex items-center justify-between mb-3"><span className="text-sm font-extrabold">{names[s.section] ?? s.section}</span><span className="text-lg font-black">{s.score}<span className="text-sm font-bold text-muted">/{maxScore}</span></span></div>
                    <div className="w-full h-2 rounded-full bg-gray2 overflow-hidden mb-3"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max((s.score / maxScore) * 100, 2)}%` }} /></div>
                    {s.reasoning && <p className="text-xs text-dark leading-relaxed mb-2">{s.reasoning}</p>}
                    {(s.strengths as string[])?.length > 0 && <div className="mb-2">{(s.strengths as string[]).map((str, i) => <p key={i} className="text-xs text-emerald-600 flex items-start gap-1.5"><span className="mt-0.5">✓</span>{str}</p>)}</div>}
                    {(s.weaknesses as string[])?.length > 0 && <div>{(s.weaknesses as string[]).map((w, i) => <p key={i} className="text-xs text-red-500 flex items-start gap-1.5"><span className="mt-0.5">✗</span>{w}</p>)}</div>}
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
