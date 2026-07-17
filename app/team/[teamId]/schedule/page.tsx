import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTeamScheduleView } from "@/lib/queries";
import { addWeeks, clampToFirstWeek, FIRST_BOOKABLE_WEEK } from "@/lib/rotation";

const WEEKS_SHOWN = 12;

function formatShort(weekStart: string): string {
  const [, m, d] = weekStart.split("-");
  return `${d}/${m}`;
}

export default function TeamSchedulePage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { start?: string };
}) {
  const teamId = Number(params.teamId);
  const team = getDb().prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as
    | { id: number; name: string }
    | undefined;
  if (!team) notFound();

  const startWeek = clampToFirstWeek(searchParams.start ?? FIRST_BOOKABLE_WEEK);
  const weekStarts = Array.from({ length: WEEKS_SHOWN }, (_, i) => addWeeks(startWeek, i));
  const rows = getTeamScheduleView(teamId, weekStarts);

  const prevStart = addWeeks(startWeek, -WEEKS_SHOWN);
  const nextStart = addWeeks(startWeek, WEEKS_SHOWN);
  const canGoBack = prevStart >= FIRST_BOOKABLE_WEEK;

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold text-ocean-900 tracking-tight">
            ตารางรอบที่ต้องเข้า{" "}
            <span className="bg-gradient-to-r from-ocean-500 to-ocean-700 bg-clip-text text-transparent">{team.name}</span>
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">
            แสดง {WEEKS_SHOWN} สัปดาห์ เริ่ม {startWeek} — ไม่รวมลีดที่มีที่นั่งประจำ (เข้าทุกสัปดาห์อยู่แล้ว)
          </p>
        </div>
        <Link href={`/team/${team.id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-ocean-600 hover:bg-ocean-50 transition-all shrink-0 w-fit">
          &larr; กลับหน้าทีม
        </Link>
      </div>

      <div className="mb-5 flex items-center gap-3">
        {canGoBack ? (
          <Link href={`?start=${prevStart}`} className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 shadow-sm hover:bg-slate-50 hover:text-ocean-900 transition-all">
            &lsaquo; {WEEKS_SHOWN} สัปดาห์ก่อน
          </Link>
        ) : (
          <span className="rounded-xl border border-slate-100 px-4 py-2 text-sm font-medium text-slate-300 cursor-not-allowed">
            &lsaquo; {WEEKS_SHOWN} สัปดาห์ก่อน
          </span>
        )}
        <Link href={`?start=${nextStart}`} className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 shadow-sm hover:bg-slate-50 hover:text-ocean-900 transition-all">
          {WEEKS_SHOWN} สัปดาห์ถัดไป &rsaquo;
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" /> เข้าออฟฟิศ</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" /> WFH</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50 shadow-inner">
        <table className="text-sm border-collapse">
          <thead className="bg-slate-100 text-left text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-100 z-10 whitespace-nowrap">ชื่อ</th>
              {weekStarts.map((w) => (
                <th key={w} className="px-2 py-3 font-semibold text-center whitespace-nowrap" title={w}>
                  {formatShort(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, weeks }) => (
              <tr key={employee.id} className="border-t border-slate-100 hover:bg-ocean-50/40 transition-colors">
                <td className="px-4 py-2.5 text-ocean-900 font-medium sticky left-0 bg-white/95 z-10 whitespace-nowrap">
                  {employee.name}
                </td>
                {weeks.map(({ weekStart, wfh }) => (
                  <td key={weekStart} className="px-2 py-2.5 text-center">
                    <span
                      className={`inline-block w-full rounded-md px-1.5 py-1 text-[11px] font-bold ${
                        wfh
                          ? "bg-amber-100 text-amber-700 border border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      }`}
                    >
                      {wfh ? "WFH" : "เข้า"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
