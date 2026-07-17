import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTeamWeekView } from "@/lib/queries";
import { weekStartOf } from "@/lib/rotation";
import WeekNav from "@/components/WeekNav";

export default function TeamPage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { week?: string };
}) {
  const teamId = Number(params.teamId);
  const team = getDb().prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as
    | { id: number; name: string }
    | undefined;
  if (!team) notFound();

  const weekStart = searchParams.week ?? weekStartOf(new Date());
  const rows = getTeamWeekView(teamId, weekStart);

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 max-w-4xl mx-auto">
      <h1 className="text-3xl font-extrabold text-ocean-900 tracking-tight mb-6 pb-6 border-b border-slate-100">
        ทีม <span className="bg-gradient-to-r from-ocean-500 to-ocean-700 bg-clip-text text-transparent">{team.name}</span>
      </h1>
      <div className="mb-8">
        <WeekNav basePath={`/team/${team.id}`} weekStart={weekStart} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-inner">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">ชื่อ</th>
              <th className="px-6 py-4 font-semibold">ที่นั่งสัปดาห์นี้</th>
              <th className="px-6 py-4 font-semibold">ที่มา</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, seat }) => (
              <tr key={employee.id} className="border-t border-slate-100 hover:bg-ocean-50/50 transition-colors">
                <td className="px-6 py-4 text-ocean-900 font-medium">{employee.name}</td>
                <td className="px-6 py-4">
                  {seat && seat.source === "wfh" ? (
                    <span className="text-amber-500 font-semibold">WFH</span>
                  ) : seat && "code" in seat ? (
                    <Link href={`/floor/${seat.floor_code}?week=${weekStart}`} className="text-ocean-600 hover:text-ocean-700 font-semibold hover:underline">
                      {seat.floor_code}-{seat.code}
                    </Link>
                  ) : (
                    <span className="text-slate-400">ไม่มีที่นั่ง</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {seat && seat.source === "wfh"
                    ? "คิว WFH"
                    : seat && "code" in seat
                    ? seat.source === "booked"
                      ? "จองเอง"
                      : "อัตโนมัติ"
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
