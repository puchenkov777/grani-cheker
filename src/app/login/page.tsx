"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch('/api/mentor/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (!response.ok) throw new Error('Неверный логин или пароль');
      const user = await response.json();
      localStorage.setItem("mentor_auth", JSON.stringify({
        name: user.name,
        role: user.role,
        displayName: user.displayName,
        ts: Date.now(),
      }));
      if (user.role === 'admin') {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError('Неверный логин или пароль');
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-orange-pale flex items-center justify-center text-3xl mx-auto mb-4">
          🔐
        </div>
        <h1 className="text-2xl font-black tracking-tight">Вход</h1>
        <p className="text-sm text-muted mt-2">Дашборд доступен для менторов и администраторов Платформы Грани</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-xs font-bold text-dark mb-1.5 block">Логин</span>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин"
            className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-dark mb-1.5 block">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            className="w-full rounded-xl border border-gray2 bg-white px-4 py-3 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all"
          />
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-orange text-white py-3.5 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all"
        >
          Войти
        </button>
      </form>

      <p className="text-center text-xs text-muted mt-8">
        Логины и пароли выдаются руководителем платформы
      </p>
    </div>
  );
}
