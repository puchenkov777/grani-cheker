"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mentor, setMentor] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Введите имя и фамилию"); setLoading(false); return; }
        if (!email.trim()) { setError("Введите email"); setLoading(false); return; }
        if (password.length < 6) { setError("Пароль — минимум 6 символов"); setLoading(false); return; }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim(), mentor: mentor || null }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Ошибка регистрации"); setLoading(false); return; }

        localStorage.setItem("user_auth", JSON.stringify({ ...data.user, ts: Date.now() }));
        router.push("/submit");
      } else {
        if (!email.trim() || !password) { setError("Введите email и пароль"); setLoading(false); return; }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Ошибка входа"); setLoading(false); return; }

        localStorage.setItem("user_auth", JSON.stringify({ ...data.user, ts: Date.now() }));
        router.push("/account");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all";

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <div className="text-center mb-8 sm:mb-10">
        <div className="w-16 h-16 rounded-full bg-orange-pale flex items-center justify-center text-3xl mx-auto mb-4">
          {mode === "login" ? "👋" : "✨"}
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          {mode === "login" ? "Вход" : "Регистрация"}
        </h1>
        <p className="text-sm text-muted mt-2">
          {mode === "login"
            ? "Войди в свой аккаунт, чтобы продолжить работу над кейсом"
            : "Создай аккаунт — черновик сохранится и будет доступен с любого устройства"}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-1 bg-gray rounded-xl p-1 border border-gray2 mb-6">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(""); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === "login" ? "bg-orange text-white shadow-sm" : "text-muted hover:text-dark"}`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => { setMode("register"); setError(""); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === "register" ? "bg-orange text-white shadow-sm" : "text-muted hover:text-dark"}`}
        >
          Регистрация
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <label className="block">
              <span className="text-xs font-bold text-dark mb-1.5 block">Имя и фамилия <span className="text-orange">*</span></span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-dark mb-1.5 block">Ментор</span>
              <select
                value={mentor}
                onChange={(e) => setMentor(e.target.value)}
                className={inputClass}
              >
                <option value="">Выбери ментора</option>
                <option value="Виктор">Виктор</option>
                <option value="Влад">Влад</option>
              </select>
            </label>
          </>
        )}

        <label className="block">
          <span className="text-xs font-bold text-dark mb-1.5 block">Email <span className="text-orange">*</span></span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputClass} />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-dark mb-1.5 block">Пароль <span className="text-orange">*</span></span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "Минимум 6 символов" : "Введите пароль"} className={inputClass} />
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange text-white py-3.5 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      <p className="text-center text-xs text-muted mt-6">
        {mode === "login" ? (
          <>Нет аккаунта? <button onClick={() => { setMode("register"); setError(""); }} className="text-orange font-bold hover:underline">Зарегистрируйся</button></>
        ) : (
          <>Уже есть аккаунт? <button onClick={() => { setMode("login"); setError(""); }} className="text-orange font-bold hover:underline">Войди</button></>
        )}
      </p>
    </div>
  );
}
