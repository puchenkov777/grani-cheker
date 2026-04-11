"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const SECTIONS = [
  {
    key: "analytics",
    emoji: "🔍",
    title: "Погрузись в тему",
    subtitle: "Аналитика",
    placeholder:
      "Опиши свою аналитику: какие факты нашёл, какие источники использовал, какие выводы сделал…",
  },
  {
    key: "idea",
    emoji: "💡",
    title: "Придумай решение",
    subtitle: "Идея",
    placeholder:
      "Опиши свою идею: концепция решения, целевая аудитория, принцип работы…",
  },
  {
    key: "steps",
    emoji: "📋",
    title: "Придумай шаги",
    subtitle: "Шаги",
    placeholder:
      "Опиши шаги реализации проекта (7 шагов): что, когда, как, кто отвечает…",
  },
  {
    key: "budget",
    emoji: "💰",
    title: "Рассчитай бюджет",
    subtitle: "Бюджет",
    placeholder:
      "Опиши бюджет: какие ресурсы нужны, источники финансирования, возможные риски…",
  },
  {
    key: "presentation",
    emoji: "📊",
    title: "Покажи, что получилось",
    subtitle: "Презентация",
    placeholder: "",
  },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function SubmitPage() {
  const router = useRouter();

  // Participant info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");

  // Section texts
  const [analytics, setAnalytics] = useState("");
  const [idea, setIdea] = useState("");
  const [steps, setSteps] = useState("");
  const [budget, setBudget] = useState("");

  // File
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const sectionValues: Record<string, string> = {
    analytics,
    idea,
    steps,
    budget,
  };
  const sectionSetters: Record<string, (v: string) => void> = {
    analytics: setAnalytics,
    idea: setIdea,
    steps: setSteps,
    budget: setBudget,
  };

  // ---------- validation ----------
  function validateParticipant(): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Укажите имя участника");
    if (!email.trim()) errs.push("Укажите email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.push("Введите корректный email");
    if (!caseTitle.trim()) errs.push("Укажите название кейса");
    return errs;
  }

  function validateStep(step: number): string[] {
    const section = SECTIONS[step];
    if (section.key === "presentation") {
      if (!file) return ["Загрузите файл презентации (.pptx)"];
      if (!file.name.toLowerCase().endsWith(".pptx"))
        return ["Допустимый формат файла — только .pptx"];
      return [];
    }
    const value = sectionValues[section.key];
    if (!value?.trim())
      return [`Заполните раздел «${section.subtitle}»`];
    return [];
  }

  // ---------- navigation ----------
  function handleNext() {
    if (currentStep === 0) {
      // we're on step 0 but participant info is always visible;
      // validate current section
    }
    const stepErrors = validateStep(currentStep);
    if (stepErrors.length) {
      setErrors(stepErrors);
      return;
    }
    setErrors([]);
    if (currentStep < SECTIONS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handlePrev() {
    setErrors([]);
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  // ---------- file handling ----------
  const handleFile = useCallback((f: File | null) => {
    if (f && !f.name.toLowerCase().endsWith(".pptx")) {
      setErrors(["Допустимый формат файла — только .pptx"]);
      return;
    }
    setErrors([]);
    setFile(f);
  }, []);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    handleFile(f);
  }

  // ---------- submit ----------
  async function handleSubmit() {
    // validate participant info first
    const pErrors = validateParticipant();
    if (pErrors.length) {
      setErrors(pErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // validate all steps
    for (let i = 0; i < SECTIONS.length; i++) {
      const stepErrors = validateStep(i);
      if (stepErrors.length) {
        setCurrentStep(i);
        setErrors(stepErrors);
        return;
      }
    }

    setErrors([]);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("email", email.trim());
      formData.append("team_name", teamName.trim());
      formData.append("case_title", caseTitle.trim());
      formData.append("section_analytics", analytics.trim());
      formData.append("section_idea", idea.trim());
      formData.append("section_steps", steps.trim());
      formData.append("section_budget", budget.trim());
      if (file) formData.append("pptx_file", file);

      const res = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Ошибка при отправке");
      }

      const data = await res.json();
      router.push(`/results/${data.submission_id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Произошла ошибка. Попробуйте снова.";
      setErrors([message]);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------- render helpers ----------
  const section = SECTIONS[currentStep];
  const isLastStep = currentStep === SECTIONS.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
      {/* Page heading */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase text-orange mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
          Отправка работы
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Заполни <span className="text-orange">кейс</span>
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-lg">
          Заполни все 5 разделов и загрузи презентацию — нейронка проверит
          работу по критериям Большой перемены.
        </p>
      </div>

      {/* ---------- Participant info card ---------- */}
      <div className="bg-gray rounded-2xl border border-gray2 p-6 md:p-8 mb-8">
        <h2 className="text-base font-extrabold mb-5 flex items-center gap-2">
          <span className="text-lg">👤</span> Информация об участнике
        </h2>

        <div className="grid md:grid-cols-2 gap-5">
          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Имя и фамилия <span className="text-orange">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иванов Иван"
              className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Email <span className="text-orange">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@example.com"
              className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Название команды{" "}
              <span className="text-muted font-normal">(необязательно)</span>
            </span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Dream Team"
              className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Название кейса <span className="text-orange">*</span>
            </span>
            <input
              type="text"
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="Мой социальный проект"
              className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
            />
          </label>
        </div>
      </div>

      {/* ---------- Step indicator ---------- */}
      <div className="flex items-center gap-2 mb-6">
        {SECTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              // allow clicking only on completed or current
              if (i <= currentStep) {
                setErrors([]);
                setCurrentStep(i);
              }
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all
              ${
                i === currentStep
                  ? "bg-orange text-white shadow-md"
                  : i < currentStep
                  ? "bg-orange-pale text-orange cursor-pointer hover:bg-orange/20"
                  : "bg-gray2/60 text-muted cursor-default"
              }
            `}
          >
            <span>{s.emoji}</span>
            <span className="hidden sm:inline">{s.subtitle}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* ---------- Section card ---------- */}
      <div className="bg-white rounded-2xl border border-gray2 shadow-sm p-6 md:p-8 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-full bg-orange-pale flex items-center justify-center text-xl">
            {section.emoji}
          </span>
          <div>
            <h3 className="text-base font-extrabold leading-tight">
              {section.title}
            </h3>
            <p className="text-xs text-muted">
              Раздел {currentStep + 1} из {SECTIONS.length} —{" "}
              {section.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {section.key !== "presentation" ? (
            <textarea
              value={sectionValues[section.key] ?? ""}
              onChange={(e) => sectionSetters[section.key]?.(e.target.value)}
              placeholder={section.placeholder}
              rows={8}
              className="w-full rounded-xl border border-gray2 bg-gray px-4 py-3 text-sm leading-relaxed outline-none resize-y focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
            />
          ) : (
            /* ---------- File upload zone ---------- */
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
                ${
                  isDragging
                    ? "border-orange bg-orange-pale"
                    : file
                    ? "border-orange/40 bg-orange-pale/50"
                    : "border-gray2 bg-gray hover:border-orange/40 hover:bg-orange-pale/30"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-orange/15 flex items-center justify-center text-2xl">
                    📄
                  </div>
                  <p className="text-sm font-bold text-dark">{file.name}</p>
                  <p className="text-xs text-muted">
                    {formatFileSize(file.size)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-1 text-xs font-bold text-orange hover:underline"
                  >
                    Удалить файл
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-orange-pale flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <p className="text-sm font-bold text-dark">
                    Перетащи файл сюда или{" "}
                    <span className="text-orange underline underline-offset-2">
                      нажми для выбора
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    Только файлы .pptx (PowerPoint)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Errors ---------- */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-6">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-600 font-medium">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* ---------- Navigation buttons ---------- */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all
            ${
              currentStep === 0
                ? "opacity-0 pointer-events-none"
                : "border-2 border-dark text-dark hover:border-orange hover:text-orange hover:bg-orange-pale"
            }
          `}
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
          Назад
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-orange text-white px-8 py-3 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                Отправляем…
              </>
            ) : (
              <>
                Отправить на проверку
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
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 bg-orange text-white px-8 py-3 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all"
          >
            Далее
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
          </button>
        )}
      </div>
    </div>
  );
}
