import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateGrade } from "@/lib/scoring";

const SECTION_MAP: Record<
  string,
  { emoji: string; title: string; subtitle: string }
> = {
  analytics: { emoji: "🔍", title: "Погрузись в тему", subtitle: "Аналитика" },
  idea: { emoji: "💡", title: "Придумай решение", subtitle: "Идея" },
  steps: { emoji: "📋", title: "Придумай шаги", subtitle: "Шаги" },
  budget: { emoji: "💰", title: "Рассчитай бюджет", subtitle: "Бюджет" },
  presentation: {
    emoji: "📊",
    title: "Покажи, что получилось",
    subtitle: "Презентация",
  },
  cross_validation: {
    emoji: "🔗",
    title: "Связность разделов",
    subtitle: "Кросс-валидация",
  },
};

const SECTION_ORDER = [
  "analytics",
  "idea",
  "steps",
  "budget",
  "presentation",
  "cross_validation",
] as const;

function scoreColor(score: number): string {
  if (score >= 30) return "bg-emerald-500";
  if (score >= 20) return "bg-yellow-400";
  if (score >= 10) return "bg-orange";
  return "bg-red-500";
}

function scoreBarWidth(score: number): string {
  return `${Math.max((score / 40) * 100, 2)}%`;
}

function statusBadge(status: string) {
  switch (status) {
    case "checking":
      return (
        <span className="inline-flex items-center gap-1.5 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full px-3 py-1 text-xs font-bold">
          <svg
            className="animate-spin h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
          >
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
          Проверяется
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full px-3 py-1 text-xs font-bold">
          <svg
            className="animate-spin h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
          >
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
          В очереди
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-3 py-1 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Проверено
        </span>
      );
    case "review":
      return (
        <span className="inline-flex items-center gap-1.5 bg-orange-pale text-orange border border-orange/30 rounded-full px-3 py-1 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-orange" />
          На проверке
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-600 border border-red-300 rounded-full px-3 py-1 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Ошибка
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 bg-gray text-muted border border-gray2 rounded-full px-3 py-1 text-xs font-bold">
          {status}
        </span>
      );
  }
}

export default async function ResultsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // Fetch submission with participant data
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("*, participants(*)")
    .eq("id", id)
    .single();

  if (submissionError || !submission) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-3xl mx-auto mb-6">
          😕
        </div>
        <h1 className="text-2xl font-black mb-3">Работа не найдена</h1>
        <p className="text-sm text-muted mb-8">
          Возможно, ссылка устарела или работа была удалена.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-orange text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-orange-light transition-colors"
        >
          На главную
        </Link>
      </div>
    );
  }

  const status = submission.status as string;
  const isWaiting = status === "pending" || status === "checking";

  // If still processing, show waiting UI
  if (isWaiting) {
    return (
      <>
        <meta httpEquiv="refresh" content="5" />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-pale flex items-center justify-center mx-auto mb-6">
            <svg
              className="animate-spin h-10 w-10 text-orange"
              viewBox="0 0 24 24"
              fill="none"
            >
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
          <h1 className="text-2xl font-black mb-3">
            Нейронка проверяет работу…
          </h1>
          <p className="text-sm text-muted mb-2 max-w-md mx-auto">
            Обычно проверка занимает 1–2 минуты. Страница обновится
            автоматически, когда результаты будут готовы.
          </p>
          <div className="mt-6">{statusBadge(status)}</div>
          <div className="mt-10 bg-gray rounded-2xl border border-gray2 p-6 max-w-sm mx-auto">
            <p className="text-xs text-muted font-medium">
              👤 {submission.participants?.name ?? "—"}
            </p>
            {submission.participants?.team_name && (
              <p className="text-xs text-muted mt-1">
                Команда: {submission.participants.team_name}
              </p>
            )}
            <p className="text-xs text-muted mt-1">
              Кейс: {submission.case_title}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Fetch scores (run_number = 1)
  const { data: scores } = await supabase
    .from("scores")
    .select("*")
    .eq("submission_id", id)
    .eq("run_number", 1)
    .order("section");

  // Fetch total_scores
  const { data: totalScoreRow } = await supabase
    .from("total_scores")
    .select("*")
    .eq("submission_id", id)
    .single();

  const totalScore = totalScoreRow?.total ?? 0;
  const grade = totalScoreRow?.grade ?? calculateGrade(totalScore);
  const needsReview = totalScoreRow?.needs_review ?? false;

  // Build scores map
  const scoresMap: Record<
    string,
    {
      score: number;
      reasoning: string;
      strengths: string[];
      weaknesses: string[];
    }
  > = {};
  if (scores) {
    for (const s of scores) {
      scoresMap[s.section] = {
        score: s.score ?? 0,
        reasoning: s.reasoning ?? "",
        strengths: (s.strengths as string[]) ?? [],
        weaknesses: (s.weaknesses as string[]) ?? [],
      };
    }
  }

  const participant = submission.participants;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase text-orange mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
          Результаты проверки
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
          Результаты <span className="text-orange">проверки</span>
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {participant?.name && (
            <span className="flex items-center gap-1.5">
              <span className="text-base">👤</span>
              <span className="font-semibold text-dark">
                {participant.name}
              </span>
            </span>
          )}
          {participant?.team_name && (
            <span className="flex items-center gap-1.5">
              <span className="text-base">👥</span>
              {participant.team_name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="text-base">📁</span>
            {submission.case_title}
          </span>
          <div>{statusBadge(status)}</div>
        </div>
      </div>

      {/* Needs review banner */}
      {needsReview && (
        <div className="bg-orange-pale border border-orange/30 rounded-2xl px-6 py-4 mb-8 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-bold text-dark">
              Результаты требуют ручной проверки куратором
            </p>
            <p className="text-xs text-muted mt-1">
              При двойной проверке нейронка выставила разные баллы за один или
              несколько разделов. Куратор скорректирует оценку вручную.
            </p>
          </div>
        </div>
      )}

      {/* Total Score Card */}
      <div className="bg-white rounded-2xl border border-gray2 shadow-sm p-8 mb-8 text-center">
        <p className="text-xs font-bold text-muted tracking-widest uppercase mb-3">
          Общий балл
        </p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-6xl md:text-7xl font-black text-dark leading-none">
            {totalScore}
          </span>
          <span className="text-2xl font-bold text-muted">/200</span>
        </div>
        <p className="mt-3 text-lg font-extrabold text-orange">{grade}</p>

        {/* Mini section bar */}
        <div className="flex justify-center gap-1.5 mt-6">
          {SECTION_ORDER.map((key) => {
            const s = scoresMap[key];
            const sc = s?.score ?? 0;
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                <span className="text-base">{SECTION_MAP[key].emoji}</span>
                <div className="w-10 h-1.5 rounded-full bg-gray2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(sc)}`}
                    style={{ width: scoreBarWidth(sc) }}
                  />
                </div>
                <span className="text-[10px] font-bold text-muted">{sc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section Score Cards */}
      <div className="space-y-5">
        {SECTION_ORDER.map((key) => {
          const meta = SECTION_MAP[key];
          const data = scoresMap[key];
          const sc = data?.score ?? 0;

          return (
            <div
              key={key}
              className="bg-white rounded-2xl border border-gray2 shadow-sm overflow-hidden"
            >
              {/* Section header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-full bg-orange-pale flex items-center justify-center text-xl">
                    {meta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-extrabold leading-tight">
                      {meta.title}{" "}
                      <span className="text-muted font-bold">
                        ({meta.subtitle})
                      </span>
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-dark">{sc}</span>
                    <span className="text-sm font-bold text-muted">/40</span>
                  </div>
                </div>

                {/* Score bar */}
                <div className="w-full h-2.5 rounded-full bg-gray2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor(sc)}`}
                    style={{ width: scoreBarWidth(sc) }}
                  />
                </div>
              </div>

              {/* Content */}
              {data && (
                <div className="px-6 pb-6 space-y-4">
                  {/* Reasoning */}
                  {data.reasoning && (
                    <div className="bg-gray rounded-xl p-4">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                        Комментарий
                      </p>
                      <p className="text-sm text-dark leading-relaxed">
                        {data.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Strengths */}
                  {data.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                        Сильные стороны
                      </p>
                      <ul className="space-y-1.5">
                        {data.strengths.map((s, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-dark leading-relaxed"
                          >
                            <span className="text-emerald-500 mt-0.5 shrink-0">
                              ✓
                            </span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Weaknesses */}
                  {data.weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">
                        Слабые стороны
                      </p>
                      <ul className="space-y-1.5">
                        {data.weaknesses.map((w, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-dark leading-relaxed"
                          >
                            <span className="text-red-500 mt-0.5 shrink-0">
                              ✗
                            </span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* No data fallback */}
              {!data && (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted italic">
                    Данные по этому разделу отсутствуют
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error status message */}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 mt-8 flex items-start gap-3">
          <span className="text-xl mt-0.5">❌</span>
          <div>
            <p className="text-sm font-bold text-red-700">
              Произошла ошибка при проверке
            </p>
            <p className="text-xs text-red-500 mt-1">
              Попробуйте отправить работу ещё раз. Если ошибка повторяется,
              обратитесь к куратору.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 border-2 border-dark text-dark px-6 py-3 rounded-xl text-sm font-bold hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Вернуться
        </Link>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 bg-orange text-white px-8 py-3 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all"
        >
          Сдать ещё раз
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
