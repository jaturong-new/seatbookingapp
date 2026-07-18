import Link from "next/link";
import { addWeeks, weekStartOf, clampToFirstWeek, FIRST_BOOKABLE_WEEK } from "@/lib/rotation";

export default function WeekNav({ basePath, weekStart }: { basePath: string; weekStart: string }) {
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const thisWeek = clampToFirstWeek(weekStartOf(new Date()));
  const atFirstWeek = weekStart <= FIRST_BOOKABLE_WEEK;
  const friday = new Date(`${weekStart}T00:00:00Z`);
  friday.setUTCDate(friday.getUTCDate() + 4);
  const fridayStr = friday.toISOString().slice(0, 10);
  const shortDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs sm:text-sm bg-[#002836]/80 p-1.5 sm:p-2 rounded-2xl w-fit border border-[#04a4cc]/20 shadow-md">
      {atFirstWeek ? (
        <span
          className="rounded-xl bg-[#002f40]/40 border border-[#04a4cc]/10 px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium text-cyan-100/30 flex items-center gap-1 cursor-not-allowed"
          title={`เริ่มจองได้ตั้งแต่สัปดาห์ ${FIRST_BOOKABLE_WEEK} เป็นต้นไป`}
        >
          <span className="text-lg leading-none">&lsaquo;</span> <span className="hidden sm:inline">สัปดาห์ก่อน</span>
        </span>
      ) : (
        <Link href={`${basePath}?week=${prev}`} className="rounded-xl bg-[#002f40] border border-[#04a4cc]/25 px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium text-cyan-100 shadow-sm hover:bg-[#04a4cc]/20 hover:text-white transition-all flex items-center gap-1">
          <span className="text-lg leading-none">&lsaquo;</span> <span className="hidden sm:inline">สัปดาห์ก่อน</span>
        </Link>
      )}
      <span className="font-semibold text-white px-1 sm:px-2 whitespace-nowrap">
        <span className="sm:hidden">{shortDate(weekStart)}&ndash;{shortDate(fridayStr)}</span>
        <span className="hidden sm:inline">
          สัปดาห์ {weekStart} <span className="text-cyan-200/40 font-normal mx-1">/</span> <span className="text-cyan-200/60 font-medium">{fridayStr}</span>
        </span>
        {weekStart === thisWeek && <span className="ml-1.5 sm:ml-3 inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-xs font-semibold text-emerald-300 border border-emerald-500/30">สัปดาห์นี้</span>}
      </span>
      <Link href={`${basePath}?week=${next}`} className="rounded-xl bg-[#002f40] border border-[#04a4cc]/25 px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium text-cyan-100 shadow-sm hover:bg-[#04a4cc]/20 hover:text-white transition-all flex items-center gap-1">
        <span className="hidden sm:inline">สัปดาห์ถัดไป</span> <span className="text-lg leading-none">&rsaquo;</span>
      </Link>
      {weekStart !== thisWeek && (
        <Link href={`${basePath}?week=${thisWeek}`} className="rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium text-cyan-100 hover:bg-[#04a4cc]/15 hover:text-white transition-all whitespace-nowrap">
          กลับสัปดาห์นี้
        </Link>
      )}
    </div>
  );
}
