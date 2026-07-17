import Link from "next/link";
import { addWeeks, weekStartOf } from "@/lib/rotation";

export default function WeekNav({ basePath, weekStart }: { basePath: string; weekStart: string }) {
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const thisWeek = weekStartOf(new Date());
  const friday = new Date(`${weekStart}T00:00:00Z`);
  friday.setUTCDate(friday.getUTCDate() + 4);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm bg-[#0a1535]/80 p-2 rounded-2xl w-fit border border-blue-500/15 shadow-md">
      <Link href={`${basePath}?week=${prev}`} className="rounded-xl bg-[#0d1e4a] border border-blue-500/20 px-4 py-2 font-medium text-blue-200 shadow-sm hover:bg-blue-500/20 hover:text-white transition-all flex items-center gap-1">
        <span className="text-lg leading-none">&lsaquo;</span> สัปดาห์ก่อน
      </Link>
      <span className="font-semibold text-white px-2">
        สัปดาห์ {weekStart} <span className="text-blue-400/40 font-normal mx-1">/</span> <span className="text-blue-300/60 font-medium">{friday.toISOString().slice(0, 10)}</span>
        {weekStart === thisWeek && <span className="ml-3 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">สัปดาห์นี้</span>}
      </span>
      <Link href={`${basePath}?week=${next}`} className="rounded-xl bg-[#0d1e4a] border border-blue-500/20 px-4 py-2 font-medium text-blue-200 shadow-sm hover:bg-blue-500/20 hover:text-white transition-all flex items-center gap-1">
        สัปดาห์ถัดไป <span className="text-lg leading-none">&rsaquo;</span>
      </Link>
      {weekStart !== thisWeek && (
        <Link href={`${basePath}?week=${thisWeek}`} className="rounded-xl px-4 py-2 font-medium text-blue-300 hover:bg-blue-500/15 hover:text-white transition-all">
          กลับสัปดาห์นี้
        </Link>
      )}
    </div>
  );
}
