"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { upload } from "@vercel/blob/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Fact {
  fact: string;
  conclusion: string;
  source: string;
}

interface IdeaFields {
  name: string;
  concept: string;
  audience: string;
  how_it_works: string;
  benefit: string;
}

interface Step {
  step: string;
  timeframe: string;
  expected_result: string;
}

interface Resource {
  resource: string;
  cost: string;
  source: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  {
    key: "analytics",
    emoji: "🔍",
    title: "Погрузись в тему",
    subtitle: "Аналитика",
  },
  {
    key: "idea",
    emoji: "💡",
    title: "Придумай решение",
    subtitle: "Идея",
  },
  {
    key: "steps",
    emoji: "📋",
    title: "Придумай шаги",
    subtitle: "Шаги",
  },
  {
    key: "budget",
    emoji: "💰",
    title: "Рассчитай бюджет",
    subtitle: "Бюджет",
  },
  {
    key: "presentation",
    emoji: "📊",
    title: "Покажи, что получилось",
    subtitle: "Презентация",
  },
] as const;

const EMPTY_FACT: Fact = { fact: "", conclusion: "", source: "" };
const EMPTY_STEP: Step = { step: "", timeframe: "", expected_result: "" };
const EMPTY_RESOURCE: Resource = { resource: "", cost: "", source: "" };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/* ------------------------------------------------------------------ */
/*  Character counter component                                        */
/* ------------------------------------------------------------------ */

function CharCounter({ current, max }: { current: number; max: number }) {
  const ratio = current / max;
  return (
    <span
      className={`text-[11px] mt-1 block text-right ${
        ratio >= 0.9 ? "text-orange font-bold" : "text-muted"
      }`}
    >
      {current}/{max}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  File upload zone component                                         */
/* ------------------------------------------------------------------ */

function FileUploadZone({
  file,
  onFile,
  accept,
  label,
  hint,
  inputRef,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  label: string;
  hint: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    onFile(f);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
        ${
          dragging
            ? "border-orange bg-orange-pale"
            : file
            ? "border-orange/40 bg-orange-pale/50"
            : "border-gray2 bg-gray hover:border-orange/40 hover:bg-orange-pale/30"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-orange/15 flex items-center justify-center text-2xl">
            📄
          </div>
          <p className="text-sm font-bold text-dark">{file.name}</p>
          <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="mt-1 text-xs font-bold text-orange hover:underline"
          >
            Удалить файл
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-orange-pale flex items-center justify-center text-2xl">
            📎
          </div>
          <p className="text-sm font-bold text-dark">
            {label}
          </p>
          <p className="text-xs text-muted">{hint}</p>
          <p className="text-xs text-orange font-bold underline underline-offset-2">
            Нажми для выбора или перетащи файл
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN PAGE COMPONENT                                                */
/* ================================================================== */

export default function SubmitPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><svg className="animate-spin h-8 w-8 text-orange" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <SubmitPage />
    </Suspense>
  );
}

function SubmitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSubmissionId = searchParams.get('edit');
  const [isEditMode, setIsEditMode] = useState(false);

  /* ---------- Participant info ---------- */
  const [name, setName] = useState("");
  const [mentor, setMentor] = useState("");
  const [challenge, setChallenge] = useState("");
  const [caseTitle, setCaseTitle] = useState("");

  /* ---------- Section 1: Analytics ---------- */
  const [facts, setFacts] = useState<Fact[]>(
    Array.from({ length: 5 }, () => ({ ...EMPTY_FACT }))
  );
  const [generalConclusion, setGeneralConclusion] = useState("");

  /* ---------- Section 2: Idea ---------- */
  const [ideaFields, setIdeaFields] = useState<IdeaFields>({
    name: "",
    concept: "",
    audience: "",
    how_it_works: "",
    benefit: "",
  });
  const [ideaFile, setIdeaFile] = useState<File | null>(null);
  const ideaFileRef = useRef<HTMLInputElement>(null);
  const [ideaFileDesc, setIdeaFileDesc] = useState("");

  /* ---------- Section 3: Steps ---------- */
  const [steps, setSteps] = useState<Step[]>(
    Array.from({ length: 7 }, () => ({ ...EMPTY_STEP }))
  );
  const [stepsFile, setStepsFile] = useState<File | null>(null);
  const stepsFileRef = useRef<HTMLInputElement>(null);
  const [stepsFileDesc, setStepsFileDesc] = useState("");

  /* ---------- Section 4: Budget ---------- */
  const [resources, setResources] = useState<Resource[]>(
    Array.from({ length: 3 }, () => ({ ...EMPTY_RESOURCE }))
  );

  /* ---------- Section 5: Presentation ---------- */
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const pptxFileRef = useRef<HTMLInputElement>(null);
  const [pptxComment, setPptxComment] = useState("");

  /* ---------- Wizard state ---------- */
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Draft: save / load from localStorage                             */
  /* ---------------------------------------------------------------- */

  const DRAFT_KEY = "grani_draft";
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [userCases, setUserCases] = useState<Array<{id: string, title: string, task_text: string}>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  // Check if user is logged in + load cases
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user_auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id) {
          setUserId(parsed.id);
          if (parsed.name) setName(parsed.name);
          if (parsed.mentor) setMentor(parsed.mentor);
          // Load user's cases
          fetch(`/api/cases?user_id=${parsed.id}`)
            .then(r => r.json())
            .then(d => setUserCases(d.cases ?? []))
            .catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Load existing submission for editing
  useEffect(() => {
    if (!editSubmissionId || !userId) return;

    async function loadSubmission() {
      try {
        const res = await fetch(`/api/submission?id=${editSubmissionId}&user_id=${userId}`);
        if (!res.ok) return;
        const { submission } = await res.json();
        if (!submission) return;

        setIsEditMode(true);
        setCaseTitle(submission.case_title || '');
        if (submission.case_id) setSelectedCaseId(submission.case_id);
        if (submission.pptx_comment) setPptxComment(submission.pptx_comment);

        // Parse JSON sections
        try {
          if (submission.section_analytics) {
            const a = JSON.parse(submission.section_analytics);
            if (a.facts?.length) setFacts(a.facts);
            if (a.general_conclusion) setGeneralConclusion(a.general_conclusion);
          }
        } catch { /* raw text */ }

        try {
          if (submission.section_idea) {
            const idea = JSON.parse(submission.section_idea);
            setIdeaFields(idea);
          }
        } catch { /* raw text */ }

        try {
          if (submission.section_steps) {
            const s = JSON.parse(submission.section_steps);
            if (Array.isArray(s) && s.length) setSteps(s);
          }
        } catch { /* raw text */ }

        try {
          if (submission.section_budget) {
            const b = JSON.parse(submission.section_budget);
            if (Array.isArray(b) && b.length) setResources(b);
          }
        } catch { /* raw text */ }
      } catch {
        // ignore
      }
    }

    loadSubmission();
  }, [editSubmissionId, userId]);

  // Load draft — from cloud first (if logged in), fallback to localStorage
  useEffect(() => {
    async function loadDraft() {
      let loaded = false;

      // Try cloud draft first
      if (userId) {
        try {
          const res = await fetch(`/api/drafts?user_id=${userId}`);
          if (res.ok) {
            const { data: d } = await res.json();
            if (d && (d.caseTitle || d.name || d.facts?.some((f: Fact) => f.fact?.trim()))) {
              applyDraft(d);
              loaded = true;
              setCloudSynced(true);
            }
          }
        } catch { /* fallback to local */ }
      }

      // Fallback to localStorage
      if (!loaded) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (!raw) return;
          const d = JSON.parse(raw);
          applyDraft(d);
        } catch { /* corrupt draft */ }
      }
    }

    function applyDraft(d: Record<string, unknown>) {
      if (d.name && !userId) setName(d.name as string);
      if (d.mentor && !userId) setMentor(d.mentor as string);
      if (d.challenge) setChallenge(d.challenge as string);
      if (d.caseTitle) setCaseTitle(d.caseTitle as string);
      if ((d.facts as Fact[])?.length) setFacts(d.facts as Fact[]);
      if (d.generalConclusion) setGeneralConclusion(d.generalConclusion as string);
      if (d.ideaFields) setIdeaFields(d.ideaFields as IdeaFields);
      if (d.ideaFileDesc) setIdeaFileDesc(d.ideaFileDesc as string);
      if ((d.steps as Step[])?.length) setSteps(d.steps as Step[]);
      if (d.stepsFileDesc) setStepsFileDesc(d.stepsFileDesc as string);
      if (d.pptxComment) setPptxComment(d.pptxComment as string);
      if ((d.resources as Resource[])?.length) setResources(d.resources as Resource[]);
      if (d.currentStep !== undefined) setCurrentStep(d.currentStep as number);
    }

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Build draft object
  function buildDraft() {
    return {
      name, mentor, challenge, caseTitle,
      facts, generalConclusion,
      ideaFields, ideaFileDesc,
      steps, stepsFileDesc,
      resources, pptxComment,
      currentStep,
      savedAt: Date.now(),
    };
  }

  // Auto-save draft every 5 seconds (localStorage + cloud)
  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      const draft = buildDraft();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

      // Cloud sync (fire and forget)
      if (userId) {
        fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, data: draft }),
        }).then(() => setCloudSynced(true)).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [name, mentor, challenge, caseTitle, facts, generalConclusion, ideaFields, ideaFileDesc, steps, stepsFileDesc, resources, pptxComment, currentStep, submitted, userId]);

  function saveDraftManual() {
    const draft = buildDraft();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    // Cloud sync
    if (userId) {
      fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, data: draft }),
      }).then(() => setCloudSynced(true)).catch(() => {});
    }

    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    // Clear cloud draft too
    if (userId) {
      fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, data: {} }),
      }).catch(() => {});
    }
  }

  async function handleExportDocx() {
    const { exportToDocx } = await import("@/lib/export-docx");
    await exportToDocx({
      name, mentor, challenge, caseTitle,
      facts, generalConclusion,
      ideaFields, steps, resources,
    });
  }

  function validateParticipant(): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Укажите имя участника");
    if (!mentor) errs.push("Выберите ментора");
    if (!caseTitle.trim()) errs.push("Укажите название кейса");
    return errs;
  }

  /* ---------------------------------------------------------------- */
  /*  Updaters                                                         */
  /* ---------------------------------------------------------------- */

  const updateFact = useCallback(
    (index: number, field: keyof Fact, value: string) => {
      setFacts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }, []);

  const addFact = useCallback(() => {
    setFacts((prev) => (prev.length < 20 ? [...prev, { ...EMPTY_FACT }] : prev));
  }, []);

  const removeFact = useCallback((index: number) => {
    setFacts((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const moveFact = useCallback((index: number, direction: 'up' | 'down') => {
    setFacts((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const updateIdeaField = useCallback(
    (field: keyof IdeaFields, value: string) => {
      setIdeaFields((prev) => ({ ...prev, [field]: value }));
    }, []);

  const updateStep = useCallback(
    (index: number, field: keyof Step, value: string) => {
      setSteps((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => (prev.length < 20 ? [...prev, { ...EMPTY_STEP }] : prev));
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const updateResource = useCallback(
    (index: number, field: keyof Resource, value: string) => {
      setResources((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }, []);

  const addResource = useCallback(() => {
    setResources((prev) => (prev.length < 20 ? [...prev, { ...EMPTY_RESOURCE }] : prev));
  }, []);

  const removeResource = useCallback((index: number) => {
    setResources((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const moveResource = useCallback((index: number, direction: 'up' | 'down') => {
    setResources((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Drag-and-drop state                                              */
  /* ---------------------------------------------------------------- */
  const [dragType, setDragType] = useState<'fact' | 'step' | 'resource' | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((type: 'fact' | 'step' | 'resource', idx: number) => {
    setDragType(type);
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragType(null);
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const handleDropStep = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }
    setSteps((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
    handleDragEnd();
  }, [dragIdx, handleDragEnd]);

  const handleDropFact = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }
    setFacts((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
    handleDragEnd();
  }, [dragIdx, handleDragEnd]);

  const handleDropResource = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }
    setResources((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
    handleDragEnd();
  }, [dragIdx, handleDragEnd]);

  /* ---------------------------------------------------------------- */
  /*  File handlers                                                    */
  /* ---------------------------------------------------------------- */

  const handlePptxFile = useCallback((f: File | null) => {
    if (f) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (![".pptx", ".pdf", ".docx", ".doc"].includes(ext)) {
        setErrors(["Допустимые форматы: .pptx, .pdf, .docx"]);
        return;
      }
    }
    setErrors([]);
    setPptxFile(f);
  }, []);

  const ALLOWED_ATTACHMENT_EXTS = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"];
  const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;

  const handleIdeaFile = useCallback((f: File | null) => {
    if (f) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!ALLOWED_ATTACHMENT_EXTS.includes(ext)) {
        setErrors(["Допустимые форматы: .jpg, .png, .pdf, .doc, .docx"]);
        return;
      }
      if (f.size > MAX_ATTACHMENT_SIZE) {
        setErrors(["Максимальный размер файла — 15 МБ"]);
        return;
      }
    }
    setErrors([]);
    setIdeaFile(f);
  }, []);

  const ALLOWED_STEPS_EXTS = [".jpg", ".jpeg", ".png", ".pdf"];

  const handleStepsFile = useCallback((f: File | null) => {
    if (f) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!ALLOWED_STEPS_EXTS.includes(ext)) {
        setErrors(["Допустимые форматы: .jpg, .png, .pdf"]);
        return;
      }
      if (f.size > MAX_ATTACHMENT_SIZE) {
        setErrors(["Максимальный размер файла — 15 МБ"]);
        return;
      }
    }
    setErrors([]);
    setStepsFile(f);
  }, []);

  function validateCurrentStep(step: number): string[] {
    const section = SECTIONS[step];

    switch (section.key) {
      case "analytics": {
        const filledFacts = facts.filter((f) => f.fact.trim().length > 0);
        if (filledFacts.length < 5)
          return [
            `Заполните минимум 5 фактов (сейчас заполнено: ${filledFacts.length})`,
          ];
        if (!generalConclusion.trim())
          return ["Заполните общий вывод"];
        return [];
      }

      case "idea": {
        const missing: string[] = [];
        if (!ideaFields.name.trim()) missing.push("Название проекта");
        if (!ideaFields.concept.trim()) missing.push("Общая концепция");
        if (!ideaFields.audience.trim()) missing.push("Целевая аудитория");
        if (!ideaFields.how_it_works.trim()) missing.push("Как работает идея");
        if (!ideaFields.benefit.trim()) missing.push("Какая польза");
        if (missing.length)
          return [`Заполните: ${missing.join(", ")}`];
        return [];
      }

      case "steps": {
        const filledSteps = steps.filter((s) => s.step.trim().length > 0);
        if (filledSteps.length < 7)
          return [
            `Заполните минимум 7 шагов (сейчас заполнено: ${filledSteps.length})`,
          ];
        return [];
      }

      case "budget": {
        const filledResources = resources.filter(
          (r) => r.resource.trim().length > 0
        );
        if (filledResources.length < 1)
          return ["Добавьте хотя бы один ресурс"];
        return [];
      }

      case "presentation": {
        if (!pptxFile) return ["Загрузите файл презентации (.pptx, .pdf, .docx)"];
        const ext = pptxFile.name.toLowerCase().slice(pptxFile.name.lastIndexOf("."));
        if (![".pptx", ".pdf", ".docx", ".doc"].includes(ext))
          return ["Допустимые форматы: .pptx, .pdf, .docx"];
        return [];
      }

      default:
        return [];
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Navigation — свободная, без валидации                            */
  /* ---------------------------------------------------------------- */

  function handleNext() {
    setErrors([]);
    if (currentStep < SECTIONS.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrev() {
    setErrors([]);
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Submit — валидация только имя + название кейса                   */
  /* ---------------------------------------------------------------- */

  async function handleSubmit() {
    const pErrors = validateParticipant();
    if (pErrors.length) {
      setErrors(pErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // At least 1 section must have some content
    const hasAnalytics = facts.some((f) => f.fact.trim().length > 0);
    const hasIdea = Object.values(ideaFields).some((v) => v.trim().length > 0);
    const hasSteps = steps.some((s) => s.step.trim().length > 0);
    const hasBudget = resources.some((r) => r.resource.trim().length > 0);
    const hasPresentation = !!pptxFile;

    if (!hasAnalytics && !hasIdea && !hasSteps && !hasBudget && !hasPresentation) {
      setErrors(["Заполните хотя бы один раздел перед отправкой"]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("mentor", mentor);
      formData.append("challenge", challenge);
      formData.append("case_title", caseTitle.trim());
      if (userId) formData.append("user_id", userId);
      if (selectedCaseId) formData.append("case_id", selectedCaseId);

      formData.append(
        "section_analytics",
        JSON.stringify({ facts, general_conclusion: generalConclusion.trim() })
      );
      formData.append("section_idea", JSON.stringify(ideaFields));
      formData.append("section_steps", JSON.stringify(steps));
      formData.append("section_budget", JSON.stringify(resources));

      const uploadAttachment = async (file: File, prefix: string) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const pathname = `uploads/${crypto.randomUUID()}_${prefix}.${ext}`;
        const result = await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: '/api/blob-upload',
          contentType: file.type || 'application/octet-stream',
        });
        return result.pathname;
      };
      if (pptxFile) formData.append("pptx_file_path", await uploadAttachment(pptxFile, 'presentation'));
      if (pptxComment.trim()) formData.append("pptx_comment", pptxComment.trim());
      if (ideaFile) formData.append("idea_attachment_path", await uploadAttachment(ideaFile, 'idea_attachment'));
      if (ideaFileDesc.trim()) formData.append("idea_file_description", ideaFileDesc.trim());
      if (stepsFile) formData.append("steps_attachment_path", await uploadAttachment(stepsFile, 'steps_attachment'));
      if (stepsFileDesc.trim()) formData.append("steps_file_description", stepsFileDesc.trim());

      let res: Response;

      if (isEditMode && editSubmissionId) {
        formData.append("submission_id", editSubmissionId);
        res = await fetch("/api/submit", {
          method: "PUT",
          body: formData,
        });
      } else {
        res = await fetch("/api/submit", {
          method: "POST",
          body: formData,
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Ошибка при отправке");
      }

      setSubmitted(true);
      clearDraft();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Произошла ошибка. Попробуйте снова.";
      setErrors([message]);
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                   */
  /* ---------------------------------------------------------------- */

  const section = SECTIONS[currentStep];
  const isLastStep = currentStep === SECTIONS.length - 1;

  /* ---------- Success screen ---------- */
  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto mb-6">
          ✅
        </div>
        <h1 className="text-2xl font-black mb-3">Работа отправлена!</h1>
        <p className="text-sm text-muted max-w-md mx-auto mb-8 leading-relaxed">
          Твоя работа принята и будет проверена ментором. Результаты проверки
          ты сможешь узнать у своего ментора.
        </p>
        <a
          href="/submit"
          className="inline-flex items-center gap-2 bg-orange text-white px-8 py-3.5 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light transition-all"
        >
          Отправить ещё одну работу
        </a>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all";

  const textareaClass =
    "w-full rounded-xl border border-gray2 bg-gray px-4 py-3 text-sm leading-relaxed outline-none resize-y focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all";

  /* ---------- Section renderers ---------- */

  function renderAnalytics() {
    return (
      <div className="space-y-4">
        {facts.map((fact, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart('fact', idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDropFact(idx)}
            className={`relative bg-white border border-gray2 rounded-xl p-5 transition-all ${
              dragType === 'fact' && dragIdx === idx ? 'opacity-40 scale-[0.98]' : ''
            } ${
              dragType === 'fact' && dragOverIdx === idx && dragIdx !== idx ? 'border-orange border-2 shadow-lg' : ''
            }`}
          >
            {/* Index badge */}
            <div className="absolute -top-3 left-4 bg-orange text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Факт {idx + 1}
            </div>
            <div
              className="absolute top-3 left-3 cursor-grab active:cursor-grabbing text-muted/40 hover:text-orange transition-colors select-none"
              title="Перетащи для перемещения"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>

            {/* Move & Remove buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveFact(idx, 'up')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вверх"
                >
                  ↑
                </button>
              )}
              {idx < facts.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveFact(idx, 'down')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вниз"
                >
                  ↓
                </button>
              )}
              {facts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFact(idx)}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors text-sm font-bold"
                  title="Удалить факт"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-3 mt-2">
              {/* Факт */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Факт <span className="text-orange">*</span>
                </label>
                <textarea
                  value={fact.fact}
                  onChange={(e) =>
                    updateFact(idx, "fact", e.target.value.slice(0, 500))
                  }
                  placeholder="Опиши факт, который ты нашёл при изучении темы кейса..."
                  rows={3}
                  className={textareaClass}
                />
                <CharCounter current={fact.fact.length} max={500} />
              </div>

              {/* Вывод из факта */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Вывод из факта
                </label>
                <textarea
                  value={fact.conclusion}
                  onChange={(e) =>
                    updateFact(idx, "conclusion", e.target.value.slice(0, 200))
                  }
                  placeholder="Какой вывод ты делаешь из этого факта?"
                  rows={2}
                  className={textareaClass}
                />
                <CharCounter current={fact.conclusion.length} max={200} />
              </div>

              {/* Источник */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Источник
                </label>
                <input
                  type="text"
                  value={fact.source}
                  onChange={(e) => updateFact(idx, "source", e.target.value)}
                  placeholder="Ссылка на источник (статья, книга, исследование)"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add fact button */}
        {facts.length < 20 && (
          <button
            type="button"
            onClick={addFact}
            className="w-full py-3 rounded-xl border-2 border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange-pale/50 transition-all"
          >
            + Добавить факт
          </button>
        )}

        {/* General conclusion */}
        <div className="bg-white border border-gray2 rounded-xl p-5 mt-6">
          <label className="text-xs font-bold text-dark mb-1.5 block">
            Общий вывод <span className="text-orange">*</span>
          </label>
          <textarea
            value={generalConclusion}
            onChange={(e) =>
              setGeneralConclusion(e.target.value.slice(0, 700))
            }
            placeholder="Сформулируй основные выводы после изучения темы..."
            rows={4}
            className={textareaClass}
          />
          <CharCounter current={generalConclusion.length} max={700} />
        </div>
      </div>
    );
  }

  function renderIdea() {
    const fields: {
      key: keyof IdeaFields;
      label: string;
      placeholder: string;
      max: number;
      rows?: number;
      type: "input" | "textarea";
    }[] = [
      {
        key: "name",
        label: "Название проекта",
        placeholder: "Как называется твой проект?",
        max: 120,
        type: "input",
      },
      {
        key: "concept",
        label: "Общая концепция",
        placeholder: "Опиши общую концепцию своего решения...",
        max: 300,
        rows: 3,
        type: "textarea",
      },
      {
        key: "audience",
        label: "Целевая аудитория",
        placeholder: "Для кого предназначено решение?",
        max: 300,
        rows: 3,
        type: "textarea",
      },
      {
        key: "how_it_works",
        label: "Как работает идея",
        placeholder: "Опиши механику работы своего решения...",
        max: 300,
        rows: 3,
        type: "textarea",
      },
      {
        key: "benefit",
        label: "Какая польза",
        placeholder: "Какую пользу принесёт проект?",
        max: 120,
        type: "input",
      },
    ];

    return (
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-bold text-dark mb-1.5 block">
              {f.label} <span className="text-orange">*</span>
            </label>
            {f.type === "textarea" ? (
              <>
                <textarea
                  value={ideaFields[f.key]}
                  onChange={(e) =>
                    updateIdeaField(f.key, e.target.value.slice(0, f.max))
                  }
                  placeholder={f.placeholder}
                  rows={f.rows ?? 3}
                  className={textareaClass}
                />
                <CharCounter current={ideaFields[f.key].length} max={f.max} />
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={ideaFields[f.key]}
                  onChange={(e) =>
                    updateIdeaField(f.key, e.target.value.slice(0, f.max))
                  }
                  placeholder={f.placeholder}
                  className={inputClass}
                />
                <CharCounter current={ideaFields[f.key].length} max={f.max} />
              </>
            )}
          </div>
        ))}

        {/* File upload */}
        <div className="mt-6">
          <label className="text-xs font-bold text-dark mb-2 block">
            Дополнительные материалы{" "}
            <span className="text-muted font-normal">(необязательно)</span>
          </label>
          <FileUploadZone
            file={ideaFile}
            onFile={handleIdeaFile}
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            label="Схема, таблица или модель"
            hint="Форматы: .jpg, .png, .pdf, .doc, .docx — до 15 МБ"
            inputRef={ideaFileRef}
          />

        </div>
      </div>
    );
  }

  function renderSteps() {
    return (
      <div className="space-y-4">
        {steps.map((s, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart('step', idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDropStep(idx)}
            className={`relative bg-white border border-gray2 rounded-xl p-5 transition-all ${
              dragType === 'step' && dragIdx === idx ? 'opacity-40 scale-[0.98]' : ''
            } ${
              dragType === 'step' && dragOverIdx === idx && dragIdx !== idx ? 'border-orange border-2 shadow-lg' : ''
            }`}
          >
            {/* Index badge + drag handle */}
            <div className="absolute -top-3 left-4 flex items-center gap-1.5">
              <div className="bg-orange text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Шаг {idx + 1}
              </div>
            </div>
            <div
              className="absolute top-3 left-3 cursor-grab active:cursor-grabbing text-muted/40 hover:text-orange transition-colors select-none"
              title="Перетащи для перемещения"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>

            {/* Move & Remove buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveStep(idx, 'up')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вверх"
                >
                  ↑
                </button>
              )}
              {idx < steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveStep(idx, 'down')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вниз"
                >
                  ↓
                </button>
              )}
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors text-sm font-bold"
                  title="Удалить шаг"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-3 mt-2">
              {/* Шаг */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Что нужно сделать? <span className="text-orange">*</span>
                </label>
                <textarea
                  value={s.step}
                  onChange={(e) => updateStep(idx, "step", e.target.value)}
                  placeholder="Что нужно сделать?"
                  rows={2}
                  className={textareaClass}
                />
              </div>

              {/* Время */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Время на выполнение
                </label>
                <input
                  type="text"
                  value={s.timeframe}
                  onChange={(e) =>
                    updateStep(idx, "timeframe", e.target.value)
                  }
                  placeholder="Например: 7 дней или 09.01-15.01.2026"
                  className={inputClass}
                />
              </div>

              {/* Ожидаемый результат */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Ожидаемый результат
                </label>
                <textarea
                  value={s.expected_result}
                  onChange={(e) =>
                    updateStep(idx, "expected_result", e.target.value)
                  }
                  placeholder="Что получим в итоге этого шага?"
                  rows={2}
                  className={textareaClass}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add step button */}
        {steps.length < 20 && (
          <button
            type="button"
            onClick={addStep}
            className="w-full py-3 rounded-xl border-2 border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange-pale/50 transition-all"
          >
            + Добавить шаг
          </button>
        )}

        {/* File upload */}
        <div className="mt-6">
          <label className="text-xs font-bold text-dark mb-2 block">
            Дополнительные материалы{" "}
            <span className="text-muted font-normal">(необязательно)</span>
          </label>
          <FileUploadZone
            file={stepsFile}
            onFile={handleStepsFile}
            accept=".jpg,.jpeg,.png,.pdf"
            label="Схема, таймлайн, диаграмма Ганта"
            hint="Форматы: .jpg, .png, .pdf — до 15 МБ"
            inputRef={stepsFileRef}
          />

        </div>
      </div>
    );
  }

  function renderBudget() {
    return (
      <div className="space-y-4">
        {resources.map((r, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleDragStart('resource', idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDropResource(idx)}
            className={`relative bg-white border border-gray2 rounded-xl p-5 transition-all ${
              dragType === 'resource' && dragIdx === idx ? 'opacity-40 scale-[0.98]' : ''
            } ${
              dragType === 'resource' && dragOverIdx === idx && dragIdx !== idx ? 'border-orange border-2 shadow-lg' : ''
            }`}
          >
            {/* Index badge */}
            <div className="absolute -top-3 left-4 bg-orange text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Ресурс {idx + 1}
            </div>
            <div
              className="absolute top-3 left-3 cursor-grab active:cursor-grabbing text-muted/40 hover:text-orange transition-colors select-none"
              title="Перетащи для перемещения"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>

            {/* Move & Remove buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveResource(idx, 'up')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вверх"
                >
                  ↑
                </button>
              )}
              {idx < resources.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveResource(idx, 'down')}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-orange-pale flex items-center justify-center text-muted hover:text-orange transition-colors text-xs font-bold"
                  title="Переместить вниз"
                >
                  ↓
                </button>
              )}
              {resources.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeResource(idx)}
                  className="w-7 h-7 rounded-full bg-gray hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors text-sm font-bold"
                  title="Удалить ресурс"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-3 mt-2">
              {/* Ресурс */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Ресурс <span className="text-orange">*</span>
                </label>
                <input
                  type="text"
                  value={r.resource}
                  onChange={(e) =>
                    updateResource(idx, "resource", e.target.value)
                  }
                  placeholder="Название ресурса"
                  className={inputClass}
                />
              </div>

              {/* Стоимость */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Стоимость
                </label>
                <input
                  type="text"
                  value={r.cost}
                  onChange={(e) =>
                    updateResource(idx, "cost", e.target.value)
                  }
                  placeholder="Сумма"
                  className={inputClass}
                />
              </div>

              {/* Источник */}
              <div>
                <label className="text-xs font-bold text-dark mb-1 block">
                  Источник
                </label>
                <input
                  type="text"
                  value={r.source}
                  onChange={(e) =>
                    updateResource(idx, "source", e.target.value)
                  }
                  placeholder="Откуда ресурс"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add resource button */}
        {resources.length < 20 && (
          <button
            type="button"
            onClick={addResource}
            className="w-full py-3 rounded-xl border-2 border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange-pale/50 transition-all"
          >
            + Добавить ресурс
          </button>
        )}
      </div>
    );
  }

  function renderPresentation() {
    return (
      <div className="space-y-4">
        <FileUploadZone
          file={pptxFile}
          onFile={handlePptxFile}
          accept=".pptx,.pdf,.docx,.doc"
          label="Перетащи файл сюда или нажми для выбора"
          hint="Форматы: .pptx, .pdf, .docx"
          inputRef={pptxFileRef}
        />
        <div>
          <label className="text-xs font-bold text-dark mb-1.5 block">
            Комментарий к презентации{" "}
            <span className="text-muted font-normal">(необязательно)</span>
          </label>
          <textarea
            value={pptxComment}
            onChange={(e) => setPptxComment(e.target.value.slice(0, 700))}
            placeholder="Комментарий к присланным материалам"
            rows={4}
            className={textareaClass}
          />
          <CharCounter current={pptxComment.length} max={700} />
        </div>
      </div>
    );
  }

  function renderSectionContent() {
    switch (section.key) {
      case "analytics":
        return renderAnalytics();
      case "idea":
        return renderIdea();
      case "steps":
        return renderSteps();
      case "budget":
        return renderBudget();
      case "presentation":
        return renderPresentation();
      default:
        return null;
    }
  }

  /* ================================================================ */
  /*  JSX                                                              */
  /* ================================================================ */

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
      {/* Page heading */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase text-orange mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
          Отправка работы
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          {isEditMode ? <>Редактировать <span className="text-orange">работу</span></> : <>Заполни <span className="text-orange">кейс</span></>}
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-lg">
          {isEditMode
            ? "Отредактируй разделы и отправь на повторную проверку."
            : "Заполняй разделы в любом порядке. Черновик сохраняется автоматически."}
        </p>
      </div>

      {/* ---------- Auth banner ---------- */}
      {!userId && (
        <div className="bg-orange-pale border border-orange/30 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-dark">Войди или зарегистрируйся</p>
            <p className="text-xs text-muted mt-0.5">Черновик будет доступен с любого устройства</p>
          </div>
          <a href="/auth" className="inline-flex items-center gap-1.5 bg-orange text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-light transition-colors shrink-0">
            Войти / Регистрация
          </a>
        </div>
      )}
      {userId && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-muted">
            {cloudSynced ? '☁️ Синхронизировано' : '💾 Сохранение...'}
          </span>
          <a href="/account" className="text-xs font-bold text-orange hover:underline">Мой кабинет</a>
        </div>
      )}

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
              className={inputClass}
              disabled={!!userId}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Ментор <span className="text-orange">*</span>
            </span>
            <select
              value={mentor}
              onChange={(e) => setMentor(e.target.value)}
              className={inputClass}
              disabled={!!userId}
            >
              <option value="">Выбери ментора</option>
              <option value="Виктор">Виктор</option>
              <option value="Влад">Влад</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Вызов <span className="text-orange">*</span>
            </span>
            <select
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              className={inputClass}
            >
              <option value="">Выбери свой вызов</option>
              <option value="Создавай будущее!">Создавай будущее!</option>
              <option value="Твори!">Твори!</option>
              <option value="Расскажи о главном!">Расскажи о главном!</option>
              <option value="Делай добро!">Делай добро!</option>
              <option value="Помни!">Помни!</option>
              <option value="Будь здоров!">Будь здоров!</option>
              <option value="Сохраняй природу!">Сохраняй природу!</option>
              <option value="Познавай Россию!">Познавай Россию!</option>
              <option value="Предпринимай!">Предпринимай!</option>
              <option value="Открывай новое!">Открывай новое!</option>
              <option value="Меняй мир вокруг!">Меняй мир вокруг!</option>
              <option value="Служи Отечеству!">Служи Отечеству!</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-dark mb-1.5 block">
              Название кейса <span className="text-orange">*</span>
            </span>
            <input
              type="text"
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="Название кейса (не проекта)"
              className={inputClass}
            />
          </label>

          {/* Case selection - only for logged in users with cases */}
          {userId && userCases.length > 0 && (
            <label className="block">
              <span className="text-xs font-bold text-dark mb-1.5 block">
                Условие задания
              </span>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className={inputClass}
              >
                <option value="">Без привязки к кейсу</option>
                {userCases.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted mt-1">Привяжи работу к загруженному кейсу — будет оценено соответствие заданию</p>
            </label>
          )}
        </div>
      </div>

      {/* ---------- Step indicator ---------- */}
      {/* ---------- Step indicator — свободная навигация ---------- */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {SECTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              setErrors([]);
              setCurrentStep(i);
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer
              ${
                i === currentStep
                  ? "bg-orange text-white shadow-md"
                  : "bg-orange-pale text-orange hover:bg-orange/20"
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

        <div className="mt-5">{renderSectionContent()}</div>
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

      {/* ---------- Submit info banner ---------- */}
      {isLastStep && (
        <div className="bg-orange-pale border border-orange/30 rounded-xl px-5 py-3 mb-4 text-sm text-dark leading-relaxed">
          Можно отправить работу на проверку в любой момент — даже если заполнен только один раздел. Ментор даст обратную связь и поможет доработать.
        </div>
      )}

      {/* ---------- Navigation + Draft buttons ---------- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Назад
        </button>

        <div className="flex items-center gap-3">
          {/* Export DOCX */}
          <button
            type="button"
            onClick={handleExportDocx}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border-2 border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
            title="Скачать черновик как Word-файл"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Скачать .docx</span>
          </button>

          {/* Save draft */}
          <button
            type="button"
            onClick={saveDraftManual}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
              draftSaved
                ? "border-emerald-400 text-emerald-600 bg-emerald-50"
                : "border-gray2 text-muted hover:border-orange hover:text-orange hover:bg-orange-pale"
            }`}
          >
            {draftSaved ? "Сохранено!" : "Сохранить черновик"}
          </button>

          {/* Next / Submit */}
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-orange text-white px-10 py-4 rounded-xl text-sm font-extrabold shadow-[0_0_30px_rgba(255,143,15,0.5)] ring-4 ring-orange/20 hover:bg-orange-light hover:shadow-[0_0_40px_rgba(255,143,15,0.6)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:pointer-events-none animate-pulse-glow"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Отправляем...
                </>
              ) : (
                <>
                  {isEditMode ? "Сохранить и отправить на проверку" : "Отправить на проверку"}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
