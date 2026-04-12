"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserSubmission {
  id: string;
  case_title: string;
  status: string;
  created_at: string;
  total_scores: { total: number; grade: string } | null;
}

interface UserCase {
  id: string;
  title: string;
  task_text: string;
  created_at: string;
}

interface UserInfo {
  id: string;
  telegram: string;
  name: string;
  mentor: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "В очереди",
  checking: "Проверяется",
  done: "Проверено",
  review: "На проверке",
  error: "Ошибка",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  checking: "bg-yellow-100 text-yellow-700 border-yellow-300",
  done: "bg-emerald-100 text-emerald-700 border-emerald-300",
  review: "bg-orange-pale text-orange border-orange/30",
  error: "bg-red-100 text-red-600 border-red-300",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [cases, setCases] = useState<UserCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);

  // Add case form
  const [showAddCase, setShowAddCase] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseText, setNewCaseText] = useState("");
  const [addingCase, setAddingCase] = useState(false);
  const [caseError, setCaseError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user_auth");
    if (!raw) {
      router.push("/auth");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.id) { router.push("/auth"); return; }
      fetchData(parsed.id);
    } catch {
      router.push("/auth");
    }
  }, [router]);

  const fetchData = useCallback(async (userId: string) => {
    try {
      const [meRes, draftRes, casesRes] = await Promise.all([
        fetch(`/api/auth/me?user_id=${userId}`),
        fetch(`/api/drafts?user_id=${userId}`),
        fetch(`/api/cases?user_id=${userId}`),
      ]);

      if (!meRes.ok) { router.push("/auth"); return; }
      const meData = await meRes.json();
      setUser(meData.user);
      setSubmissions(meData.submissions ?? []);

      if (draftRes.ok) {
        const draftData = await draftRes.json();
        const d = draftData.data;
        if (d && (d.caseTitle || d.facts?.some((f: { fact: string }) => f.fact?.trim()) || d.name)) {
          setHasDraft(true);
        }
      }

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData.cases ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  async function handleAddCase(e: React.FormEvent) {
    e.preventDefault();
    setCaseError("");
    if (!newCaseTitle.trim() || !newCaseText.trim()) {
      setCaseError("Заполни название и текст задания");
      return;
    }
    setAddingCase(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, title: newCaseTitle.trim(), task_text: newCaseText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCaseError(data.error || "Ошибка"); return; }
      setCases((prev) => [data.case, ...prev]);
      setNewCaseTitle("");
      setNewCaseText("");
      setShowAddCase(false);
    } catch {
      setCaseError("Ошибка соединения");
    } finally {
      setAddingCase(false);
    }
  }

  async function handleDeleteCase(caseId: string) {
    if (!confirm("Удалить кейс?")) return;
    try {
      await fetch("/api/cases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, user_id: user!.id }),
      });
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch { /* ignore */ }
  }

  function handleLogout() {
    localStorage.removeItem("user_auth");
    router.push("/auth");
  }

  const inputClass = "w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <svg className="animate-spin h-8 w-8 text-orange" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-orange mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            Личный кабинет
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{user.name}</h1>
          <p className="text-xs text-muted mt-1">
            {user.telegram && <>@{user.telegram}</>}
            {user.mentor && <> &middot; Ментор: <span className="font-bold text-orange">{user.mentor}</span></>}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-muted hover:text-orange transition-colors"
        >
          Выйти
        </button>
      </div>

      {/* Draft banner */}
      {hasDraft && (
        <Link
          href="/submit"
          className="block mb-6 bg-orange-pale border border-orange/30 rounded-xl p-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-dark">У тебя есть незавершённый черновик</p>
              <p className="text-xs text-muted mt-0.5">Продолжи заполнение кейса</p>
            </div>
            <span className="text-orange font-bold text-sm group-hover:translate-x-1 transition-transform">
              Продолжить →
            </span>
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 bg-orange text-white px-5 py-3 rounded-xl text-sm font-bold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:-translate-y-0.5 transition-all"
        >
          {hasDraft ? "Продолжить кейс" : "Заполнить новый кейс"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
        <button
          onClick={() => setShowAddCase(!showAddCase)}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border-2 transition-all ${showAddCase ? 'border-orange text-orange bg-orange-pale' : 'border-dark text-dark hover:border-orange hover:text-orange hover:bg-orange-pale'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить кейс
        </button>
      </div>

      {/* Add case form */}
      {showAddCase && (
        <form onSubmit={handleAddCase} className="bg-gray rounded-xl border border-gray2 p-5 sm:p-6 mb-8 space-y-4">
          <h3 className="text-sm font-extrabold">Загрузить условие задания</h3>
          <p className="text-xs text-muted -mt-2">Загрузи текст своего кейса — при проверке будет оцениваться соответствие решения заданию</p>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">Название кейса <span className="text-orange">*</span></span>
            <input
              type="text"
              value={newCaseTitle}
              onChange={(e) => setNewCaseTitle(e.target.value)}
              placeholder="Например: Экологический проект для города"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">Текст задания <span className="text-orange">*</span></span>
            <textarea
              value={newCaseText}
              onChange={(e) => setNewCaseText(e.target.value)}
              placeholder="Вставь полный текст условия задания (кейса) из Большой перемены..."
              rows={8}
              className={`${inputClass} resize-y bg-gray`}
            />
          </label>

          {caseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-red-600 font-medium">{caseError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addingCase}
              className="bg-orange text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-light transition-all disabled:opacity-50"
            >
              {addingCase ? "Сохранение..." : "Сохранить кейс"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddCase(false); setCaseError(""); }}
              className="text-sm font-bold text-muted hover:text-dark transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* My cases */}
      {cases.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg sm:text-xl font-black tracking-tight mb-4">
            Мои кейсы
            <span className="text-muted font-bold ml-2 text-base">({cases.length})</span>
          </h2>
          <div className="space-y-3">
            {cases.map((c) => (
              <div key={c.id} className="bg-white border border-gray2 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-dark">{c.title}</p>
                    <p className="text-xs text-muted mt-0.5">{formatDate(c.created_at)}</p>
                    <p className="text-xs text-dark mt-2 line-clamp-3 leading-relaxed">{c.task_text}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCase(c.id)}
                    className="shrink-0 w-7 h-7 rounded-full bg-gray hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors text-sm font-bold"
                    title="Удалить кейс"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submissions history */}
      <div>
        <h2 className="text-lg sm:text-xl font-black tracking-tight mb-4">
          Отправленные работы
          {submissions.length > 0 && <span className="text-muted font-bold ml-2 text-base">({submissions.length})</span>}
        </h2>

        {submissions.length === 0 ? (
          <div className="bg-gray rounded-xl border border-gray2 p-8 text-center">
            <p className="text-sm text-muted">Ты ещё не отправлял работы</p>
            <p className="text-xs text-muted mt-1">Заполни кейс и отправь его на проверку</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <Link
                key={sub.id}
                href={`/results/${sub.id}`}
                className="block bg-white border border-gray2 rounded-xl p-4 hover:bg-orange-pale/30 hover:border-orange/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-dark truncate">{sub.case_title}</p>
                    <p className="text-xs text-muted mt-0.5">{formatDate(sub.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.total_scores && (
                      <span className="text-sm font-black text-dark">
                        {sub.total_scores.total}
                        <span className="text-xs font-bold text-muted">/200</span>
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[sub.status] ?? "bg-gray text-muted border-gray2"}`}>
                      {STATUS_LABELS[sub.status] ?? sub.status}
                    </span>
                  </div>
                </div>
                {sub.total_scores?.grade && (
                  <p className="text-xs mt-2">
                    Оценка: <span className="font-bold text-orange">{sub.total_scores.grade}</span>
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
