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
        <header className="sticky top-0 z-50 border-b border-blue-500/15 bg-[#03091e]/60 backdrop-blur-xl shadow-lg">
          <div className="mx-auto flex max-w-[98vw] flex-wrap items-center justify-between gap-y-4 px-6 py-4">
            <Link href="/" className="flex items-center gap-3 text-xl font-bold tracking-tight text-white transition-colors hover:text-blue-300">
              <img src="/favicon.png" alt="Ocean Life Logo" className="h-8 w-8 object-contain rounded-lg shadow-sm" />
              Mobile Office
            </Link>
 
            <div className="flex flex-wrap items-center gap-8">
              <nav className="flex items-center gap-2 text-sm font-medium">
                <span className="text-blue-400/60 mr-2 text-xs uppercase tracking-wider">ผังชั้น</span>
                {floors.map((f) => (
                  <Link key={f.code} href={`/floor/${f.code}`} className="rounded-full px-3 py-1.5 text-blue-200 transition-all hover:bg-blue-500/15 hover:text-white">
                    {f.name}
                  </Link>
                ))}
              </nav>
 
              <div className="h-5 w-px bg-blue-500/20 hidden md:block"></div>
 
              <nav className="flex items-center gap-2 text-sm font-medium">
                <span className="text-blue-400/60 mr-2 text-xs uppercase tracking-wider">ทีม</span>
                {teams.map((t) => (
                  <Link key={t.id} href={`/team/${t.id}`} className="rounded-full px-3 py-1.5 text-blue-200 transition-all hover:bg-blue-500/15 hover:text-white">
                    {t.name}
                  </Link>
                ))}
              </nav>
            </div>
 
            <Link href="/admin" className="rounded-full bg-[#0a1535] border border-blue-500/20 px-4 py-1.5 text-xs font-semibold text-blue-200 transition-all hover:bg-blue-500/20 hover:text-white">
              Admin
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[98vw] px-6 py-10 animate-fade-in-up">
          {children}
        </main>
      </body>
    </html>
  );
}
