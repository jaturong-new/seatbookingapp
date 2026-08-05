import "./globals.css";
import Link from "next/link";
import { getFloors, getStaffedTeams } from "@/lib/queries";
import { hasReadAccess } from "@/lib/auth";
import PersonPicker from "@/components/PersonPicker";
import NavMenu from "@/components/NavMenu";

import { Noto_Sans_Thai, Outfit } from "next/font/google";

const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"] });
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-outfit" });

export const metadata = {
  title: "จองที่นั่ง Mobile Office",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nothing about floors/teams shows in the nav until signed in — the page body itself is
  // gated per-route (see LoginGate), but the nav links would leak team/floor names too.
  const signedIn = await hasReadAccess();
  const floors = signedIn ? getFloors() : [];
  const teams = signedIn ? getStaffedTeams() : [];

  return (
    <html lang="th">
      <body className={`${notoSansThai.className} ${outfit.variable} min-h-screen text-white selection:bg-blue-500/30 selection:text-white`}>
        <header className="sticky top-0 z-50 border-b border-[#04a4cc]/15 bg-[#002330]/75 backdrop-blur-xl shadow-lg">
          <div className="mx-auto flex max-w-[98vw] flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-y-2 sm:gap-y-4 px-3 sm:px-6 py-2.5 sm:py-4">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-bold tracking-tight text-white transition-colors hover:text-[#44bbdb] shrink-0">
              <img src="/favicon.png" alt="Ocean Life Logo" className="h-6 w-6 sm:h-8 sm:w-8 object-contain rounded-lg shadow-sm" />
              Mobile Office
            </Link>

            {signedIn && (
              <div className="flex items-center gap-1 sm:gap-2">
                <NavMenu label="ผังชั้น" items={floors.map((f) => ({ href: `/floor/${f.code}`, label: f.name }))} />
                <NavMenu label="ทีม" items={teams.map((t) => ({ href: `/team/${t.id}`, label: t.name }))} />
                <NavMenu label="ตารางเข้า" items={teams.map((t) => ({ href: `/team/${t.id}/schedule`, label: t.name }))} />
              </div>
            )}

            <div className="shrink-0">
              <PersonPicker />
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
