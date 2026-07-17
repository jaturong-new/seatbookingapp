import { notFound } from "next/navigation";
import { getFloorByCode, getFloorAssignments } from "@/lib/queries";
import { weekStartOf } from "@/lib/rotation";
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

  const weekStart = searchParams.week ?? weekStartOf(new Date());
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
      <div className="sticky top-16 z-40 -mx-6 mb-8 border-b border-blue-500/10 bg-[#03091e]/80 px-6 py-3.5 shadow-lg backdrop-blur-xl">
        <div className="mx-auto flex max-w-[98vw] flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-white whitespace-nowrap">
            ผังที่นั่ง{" "}
            <span className="bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent">{floor.name}</span>
          </h1>
          <WeekNav basePath={`/floor/${floor.code}`} weekStart={weekStart} />
          <PersonPicker />
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-blue-500/15 bg-[#0a1535]/80 p-6 shadow-2xl backdrop-blur-md md:p-10">
        <FloorMap seats={seats} weekStart={weekStart} floorName={`Floor ${floor.code.replace(/^F/i, "")}`} />
      </div>
    </div>
  );
}
