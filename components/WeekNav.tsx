import Link from "next/link";
import { addWeeks, weekStartOf } from "@/lib/rotation";

export default function WeekNav({ basePath, weekStart }: { basePath: string; weekStart: string }) {
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const thisWeek = weekStartOf(new Date());
  const friday = new Date(`${weekStart}T00:00:00Z`);
  friday.setUTCDate(friday.getUTCDate() + 4);

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm bg-slate-100/70 p-2 rounded-2xl w-fit border border-slate-200">
      <Link href={`${basePath}?week=${prev}`} className="rounded-xl bg-white border border-slate-200 px-4 py-2 font-medium text-slate-500 shadow-sm hover:bg-slate-50 hover:text-ocean-900 transition-all flex items-center gap-1">
        <span className="text-lg leading-none">&lsaquo;</span> สัปดาห์ก่อน
      </Link>
      <span className="font-semibold text-ocean-900 px-2">
        สัปดาห์ {weekStart} <span className="text-slate-400 font-normal mx-1">/</span> <span className="text-slate-500 font-medium">{friday.toISOString().slice(0, 10)}</span>
        {weekStart === thisWeek && <span className="ml-3 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-200">สัปดาห์นี้</span>}
      </span>
      <Link href={`${basePath}?week=${next}`} className="rounded-xl bg-white border border-slate-200 px-4 py-2 font-medium text-slate-500 shadow-sm hover:bg-slate-50 hover:text-ocean-900 transition-all flex items-center gap-1">
        สัปดาห์ถัดไป <span className="text-lg leading-none">&rsaquo;</span>
      </Link>
      {weekStart !== thisWeek && (
        <Link href={`${basePath}?week=${thisWeek}`} className="rounded-xl px-4 py-2 font-medium text-ocean-600 hover:bg-white transition-all ml-2">
          กลับสัปดาห์นี้
        </Link>
      )}
    </div>
  );
}
