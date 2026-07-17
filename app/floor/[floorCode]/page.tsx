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
    <div className="bg-[#0a1535]/80 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-blue-500/15">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-blue-500/10">
        <div>
          <span className="text-xs uppercase tracking-widest font-extrabold bg-blue-500/15 text-blue-300 px-3 py-1.5 rounded-full inline-block mb-3 border border-blue-500/20 shadow-sm">
            ผังชั้นทำงาน
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            ผังที่นั่ง <span className="bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent">{floor.name}</span>
          </h1>
          <p className="text-blue-300/60 mt-1.5 font-medium">จัดการและเลือกที่นั่งประจำสัปดาห์ของคุณ</p>
        </div>
        <PersonPicker />
      </div>
      <div className="mb-8">
        <WeekNav basePath={`/floor/${floor.code}`} weekStart={weekStart} />
      </div>
      <FloorMap seats={seats} weekStart={weekStart} />
    </div>
  );
}
