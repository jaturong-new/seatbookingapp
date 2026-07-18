import "./globals.css";
import Link from "next/link";
import { getFloors, getTeams } from "@/lib/queries";

import { Noto_Sans_Thai, Outfit } from "next/font/google";

const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"] });
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-outfit" });

export const metadata = {
  title: "จองที่นั่ง Mobile Office",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const floors = getFloors();
  const teams = getTeams();

  return (
    <html lang="th">
      <body className={`${notoSansThai.className} ${outfit.variable} min-h-screen text-white selection:bg-blue-500/30 selection:text-white`}>
        <header className="sticky top-0 z-50 border-b border-[#04a4cc]/15 bg-[#002330]/75 backdrop-blur-xl shadow-lg">
          <div className="mx-auto flex max-w-[98vw] flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-y-2 sm:gap-y-4 px-3 sm:px-6 py-2.5 sm:py-4">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-bold tracking-tight text-white transition-colors hover:text-[#44bbdb] shrink-0">
              <img src="/favicon.png" alt="Ocean Life Logo" className="h-6 w-6 sm:h-8 sm:w-8 object-contain rounded-lg shadow-sm" />
              Mobile Office
            </Link>

            <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden -mx-3 px-3 sm:mx-0 sm:px-0">
              <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium shrink-0">
                <span className="text-cyan-200/60 mr-1 sm:mr-2 text-[10px] sm:text-xs uppercase tracking-wider whitespace-nowrap">ผังชั้น</span>
                {floors.map((f) => (
                  <Link key={f.code} href={`/floor/${f.code}`} className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-cyan-100 transition-all hover:bg-[#04a4cc]/15 hover:text-white whitespace-nowrap">
                    {f.name}
                  </Link>
                ))}
              </nav>

              <div className="h-5 w-px bg-[#04a4cc]/20 hidden md:block shrink-0"></div>

              <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium shrink-0">
                <span className="text-cyan-200/60 mr-1 sm:mr-2 text-[10px] sm:text-xs uppercase tracking-wider whitespace-nowrap">ทีม</span>
                {teams.map((t) => (
                  <Link key={t.id} href={`/team/${t.id}`} className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-cyan-100 transition-all hover:bg-[#04a4cc]/15 hover:text-white whitespace-nowrap">
                    {t.name}
                  </Link>
                ))}
              </nav>

              <div className="h-5 w-px bg-[#04a4cc]/20 hidden md:block shrink-0"></div>

              <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium shrink-0">
                <span className="text-cyan-200/60 mr-1 sm:mr-2 text-[10px] sm:text-xs uppercase tracking-wider whitespace-nowrap">ตารางเข้า</span>
                {teams.map((t) => (
                  <Link key={t.id} href={`/team/${t.id}/schedule`} className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-cyan-100 transition-all hover:bg-[#04a4cc]/15 hover:text-white whitespace-nowrap">
                    {t.name}
                  </Link>
                ))}
              </nav>
            </div>

          </div>
        </header>
        <main className="mx-auto max-w-[98vw] px-3 sm:px-6 py-3 sm:py-4 animate-fade-in-up">
          {children}
        </main>
      </body>
    </html>
  );
}
