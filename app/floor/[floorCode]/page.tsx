import { notFound } from "next/navigation";
import { getFloorByCode, getFloorAssignments } from "@/lib/queries";
import { weekStartOf, clampToFirstWeek } from "@/lib/rotation";
import WeekNav from "@/components/WeekNav";
import FloorMap from "@/components/FloorMap";
import PersonPicker from "@/components/PersonPicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FloorPage({
  params,
  searchParams,
}: {
  params: { floorCode: string };
  searchParams: { week?: string };
}) {
  const floor = getFloorByCode(params.floorCode);
  if (!floor) notFound();

  const weekStart = clampToFirstWeek(searchParams.week ?? weekStartOf(new Date()));
  const assignments = getFloorAssignments(floor.id, weekStart);

  const seats = assignments.map((a) => ({
    id: a.seat.id,
    code: a.seat.code,
    grid_row: a.seat.grid_row,
    grid_col: a.seat.grid_col,
    employee: a.employee ? { id: a.employee.id, name: a.employee.name, team_name: a.employee.team_name } : null,
    source: a.source,
    autoEmployee: a.autoEmployee ? { id: a.autoEmployee.id, name: a.autoEmployee.name, team_name: a.autoEmployee.team_name } : null,
  }));

  return (
    <div>
      {/* Sticky control bar: week navigation + identity picker stay visible while scrolling the map */}
      <div className="sticky top-16 z-40 -mx-6 mb-4 border-b border-[#04a4cc]/15 bg-[#002330]/85 px-6 py-3 shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex max-w-[98vw] flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
            ผังที่นั่ง{" "}
            <span className="bg-gradient-to-r from-[#44bbdb] to-[#04a4cc] bg-clip-text text-transparent">{floor.name}</span>
            <span className="text-xs font-normal text-cyan-200/60 hidden xl:inline">| จัดการและเลือกที่นั่งประจำสัปดาห์</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <WeekNav basePath={`/floor/${floor.code}`} weekStart={weekStart} />
            <PersonPicker />
          </div>
        </div>
      </div>

      <div className="bg-[#002836]/80 backdrop-blur-md rounded-[1.5rem] p-4 md:p-6 shadow-2xl border border-[#04a4cc]/20">
        <FloorMap seats={seats} weekStart={weekStart} floorName={`Floor ${floor.code.replace(/^F/i, "")}`} />
      </div>
    </div>
  );
}
