import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Грани Чекер | Проверка кейсов",
  description: "Сервис проверки решений кейсов Большой перемены от Платформы Грани",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-dark">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-orange/15">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <img
                src="https://cdn.phototourl.com/free/2026-04-08-4279d01f-744c-4cba-97a9-06b8783ef05f.png"
                alt="Грани"
                className="h-8 sm:h-10 w-auto"
              />
              <div>
                <div className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">Грани Чекер</div>
                <div className="text-[9px] sm:text-[10px] text-muted tracking-wider">Проверка кейсов</div>
              </div>
            </Link>
            <nav className="flex items-center gap-3 sm:gap-6">
              <a href="/submit" className="hidden sm:block text-xs font-semibold tracking-wide hover:text-orange transition-colors">
                Сдать работу
              </a>
              <a href="/login" className="hidden sm:block text-xs font-semibold tracking-wide hover:text-orange transition-colors">
                Для менторов
              </a>
              <a href="/account" className="hidden sm:block text-xs font-semibold tracking-wide hover:text-orange transition-colors">
                Мой кабинет
              </a>
              <a
                href="/submit"
                className="bg-orange text-white px-4 sm:px-5 py-2 rounded-lg text-[11px] sm:text-xs font-bold hover:bg-orange-light transition-colors"
              >
                Заполнить кейс
              </a>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-dark text-white/40 py-6 sm:py-8 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-[10px] sm:text-xs text-center sm:text-left">
              &copy; 2026 АНО ДО &laquo;Платформа Грани&raquo; &middot; Все права защищены
            </p>
            <div className="flex gap-4">
              <a href="https://t.me/platformgran" target="_blank" className="text-[10px] sm:text-xs hover:text-orange transition-colors">
                Telegram
              </a>
              <a href="mailto:info@anogran.ru" className="text-[10px] sm:text-xs hover:text-orange transition-colors">
                info@anogran.ru
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
