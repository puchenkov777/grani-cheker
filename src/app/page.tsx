import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Hero */}
      <section className="py-24 md:py-32">
        <div className="inline-flex items-center gap-2 bg-orange-pale border border-orange/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase text-orange mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
          Большая перемена 2026
        </div>

        <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight max-w-3xl mb-6">
          Подготовь свой кейс
          <br />
          <span className="text-orange">к отправке.</span>
        </h1>

        <p className="text-base md:text-lg text-muted max-w-xl leading-relaxed mb-10">
          Заполни решение кейса{" "}
          <strong className="text-dark font-bold">по разделам</strong>,
          сохрани черновик и отправь на проверку ментору.
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 bg-orange text-white px-8 py-4 rounded-lg text-sm font-extrabold tracking-wide shadow-[0_8px_30px_rgba(255,143,15,0.35)] hover:bg-orange-light hover:shadow-[0_14px_40px_rgba(255,143,15,0.45)] hover:-translate-y-0.5 transition-all"
          >
            Загрузить работу
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border-2 border-dark text-dark px-7 py-4 rounded-lg text-sm font-bold tracking-wide hover:border-orange hover:text-orange hover:bg-orange-pale transition-all"
          >
            Вход для менторов
          </Link>
        </div>
      </section>

      {/* Как это работает */}
      <section className="pb-24">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange mb-4 flex items-center gap-2.5">
          <span className="w-5 h-0.5 bg-orange" />
          Как это работает
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-12">
          Три шага — <span className="text-orange">простая отправка</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              num: "1",
              title: "Заполняешь кейс",
              desc: "5 разделов: аналитика, идея, шаги, бюджет + презентация. Можно в любом порядке, черновик сохраняется",
            },
            {
              num: "2",
              title: "Отправляешь ментору",
              desc: "Работа уходит на проверку твоему ментору. Можно скачать черновик как Word-файл",
            },
            {
              num: "3",
              title: "Получаешь обратную связь",
              desc: "Ментор проверяет работу по критериям Большой перемены и даёт рекомендации по доработке",
            },
          ].map((step) => (
            <div
              key={step.num}
              className="bg-gray rounded-2xl p-7 border border-gray2 hover:shadow-lg hover:-translate-y-1 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-orange text-white flex items-center justify-center text-sm font-black mb-4 group-hover:scale-110 transition-transform">
                {step.num}
              </div>
              <h3 className="text-base font-extrabold mb-2">{step.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Разделы кейса */}
      <section className="pb-24">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange mb-4 flex items-center gap-2.5">
          <span className="w-5 h-0.5 bg-orange" />
          Разделы кейса
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-12">
          Пять разделов — <span className="text-orange">один кейс</span>
        </h2>

        <div className="grid md:grid-cols-5 gap-4">
          {[
            { emoji: "🔍", title: "Аналитика", desc: "Погрузись в тему: факты, источники, выводы" },
            { emoji: "💡", title: "Идея", desc: "Придумай решение: концепция, ЦА, принцип работы" },
            { emoji: "📋", title: "Шаги", desc: "Продумай шаги: 7 шагов реализации проекта" },
            { emoji: "💰", title: "Бюджет", desc: "Рассчитай бюджет: ресурсы, источники, риски" },
            { emoji: "📊", title: "Презентация", desc: "Покажи результат: PPTX с итогами проекта" },
          ].map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray2 rounded-2xl p-5 text-center hover:shadow-lg hover:-translate-y-1.5 hover:border-orange/20 transition-all relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
              <div className="w-14 h-14 rounded-full bg-orange-pale flex items-center justify-center text-2xl mx-auto mb-3">
                {section.emoji}
              </div>
              <h3 className="text-sm font-extrabold mb-1.5">{section.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{section.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
