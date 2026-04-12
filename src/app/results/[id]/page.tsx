import Link from "next/link";

export default async function ResultsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-orange-pale flex items-center justify-center text-4xl mx-auto mb-6">
        🔒
      </div>
      <h1 className="text-2xl font-black mb-3">Доступ ограничен</h1>
      <p className="text-sm text-muted max-w-md mx-auto mb-8 leading-relaxed">
        Результаты проверки доступны только менторам. Обратись к своему ментору,
        чтобы узнать баллы и рекомендации по доработке.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 border-2 border-dark text-dark px-6 py-3 rounded-xl text-sm font-bold hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
        >
          На главную
        </Link>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 bg-orange text-white px-8 py-3 rounded-xl text-sm font-extrabold shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light transition-all"
        >
          Сдать работу
        </Link>
      </div>
    </div>
  );
}
