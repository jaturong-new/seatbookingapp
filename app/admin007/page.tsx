import { revalidatePath } from "next/cache";
import {
  getTeams,
  getAllEmployeesIncludingInactive,
  addEmployee,
  setEmployeeActive,
  setEmployeeEmail,
  listOverridesForWeek,
  clearOverride,
} from "@/lib/queries";
import { getDb } from "@/lib/db";
import { AUTH_ENABLED, getSessionEmail } from "@/lib/auth";
import { weekStartOf, clampToFirstWeek } from "@/lib/rotation";
import WeekNav from "@/components/WeekNav";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Admin gate: when auth is on and ADMIN_EMAILS is set, only those Google accounts may enter
 * (and use the actions below). Auth off = legacy mode, page stays open as before. */
async function assertAdmin(): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  const allowed = adminEmails();
  if (allowed.length === 0) return true; // not configured -> open (dev mode)
  const email = await getSessionEmail();
  return !!email && allowed.includes(email);
}

async function addEmployeeAction(formData: FormData) {
  "use server";
  if (!(await assertAdmin())) return;
  const name = String(formData.get("name") ?? "").trim();
  const teamId = Number(formData.get("teamId"));
  if (!name || !teamId) return;
  addEmployee(name, teamId);
  revalidatePath("/admin007");
}

async function toggleActiveAction(formData: FormData) {
  "use server";
  if (!(await assertAdmin())) return;
  const employeeId = Number(formData.get("employeeId"));
  const active = formData.get("active") === "1";
  setEmployeeActive(employeeId, active);
  revalidatePath("/admin007");
}

async function setEmailAction(formData: FormData) {
  "use server";
  if (!(await assertAdmin())) return;
  const employeeId = Number(formData.get("employeeId"));
  const email = String(formData.get("email") ?? "").trim();
  if (!employeeId) return;
  setEmployeeEmail(employeeId, email || null);
  revalidatePath("/admin007");
}

async function clearOverrideAction(formData: FormData) {
  "use server";
  if (!(await assertAdmin())) return;
  const seatFullCode = String(formData.get("seatFullCode"));
  const weekStart = String(formData.get("weekStart"));
  const seat = getDb().prepare(`SELECT id FROM seats WHERE full_code = ?`).get(seatFullCode) as
    | { id: number }
    | undefined;
  if (seat) clearOverride(seat.id, weekStart);
  revalidatePath("/admin007");
}

function EmployeeRow({ e, muted }: { e: { id: number; name: string; team_name: string; active: number; email: string | null }; muted: boolean }) {
  return (
    <tr className={`border-t border-slate-100 transition-colors ${muted ? "opacity-50 hover:opacity-100" : "hover:bg-ocean-50/50"}`}>
      <td className="px-4 py-3 text-ocean-900 font-medium">{e.name}</td>
      <td className="px-4 py-3 text-slate-500">{e.team_name}</td>
      <td className="px-4 py-3">
        <form action={setEmailAction} className="flex items-center gap-2">
          <input type="hidden" name="employeeId" value={e.id} />
          <input
            name="email"
            type="email"
            defaultValue={e.email ?? ""}
            placeholder="ยังไม่ผูก"
            className="w-48 rounded-md bg-slate-50 border border-slate-200 text-xs text-ocean-900 px-2 py-1 outline-none focus:border-ocean-500 transition-colors placeholder:text-slate-300"
          />
          <button className="text-ocean-600 hover:text-ocean-700 text-xs font-semibold hover:underline whitespace-nowrap" title="บันทึก email (เว้นว่าง = ล้าง mapping)">
            บันทึก
          </button>
        </form>
      </td>
      <td className="px-4 py-3">
        {e.active ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Active</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200">Inactive</span>
        )}
      </td>
      <td className="px-4 py-3">
        <form action={toggleActiveAction}>
          <input type="hidden" name="employeeId" value={e.id} />
          <input type="hidden" name="active" value={e.active ? "0" : "1"} />
          <button className="text-ocean-600 hover:text-ocean-700 font-semibold hover:underline">
            {e.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        </form>
      </td>
    </tr>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: { week?: string } }) {
  if (!(await assertAdmin())) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-2xl border border-rose-200 bg-white/90 p-8 text-center shadow-xl">
        <div className="text-3xl mb-3">🚫</div>
        <h1 className="text-xl font-bold text-rose-600 mb-2">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="text-sm text-slate-500">ต้อง login ด้วย Google account ที่อยู่ในรายชื่อ admin (ADMIN_EMAILS)</p>
      </div>
    );
  }
  const teams = getTeams();
  const employees = getAllEmployeesIncludingInactive();
  const activeEmployees = employees.filter((e) => e.active);
  const inactiveEmployees = employees.filter((e) => !e.active);
  const weekStart = clampToFirstWeek(searchParams.week ?? weekStartOf(new Date()));
  const overrides = listOverridesForWeek(weekStart);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-extrabold text-ocean-900 tracking-tight">แผงควบคุมระบบ (Admin)</h1>

      <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md p-6 shadow-xl">
        <h2 className="mb-4 font-bold text-ocean-900 text-lg flex items-center gap-2">
          <span className="w-1.5 h-6 bg-ocean-500 rounded-full inline-block"></span>
          เพิ่มพนักงาน
        </h2>
        <form action={addEmployeeAction} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ-นามสกุล</label>
            <input name="name" required className="w-full rounded-lg bg-slate-50 border border-slate-200 text-sm text-ocean-900 px-3 py-2 outline-none focus:border-ocean-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">ทีม</label>
            <select name="teamId" required className="rounded-lg bg-white border border-slate-200 text-sm text-ocean-900 px-3 py-2 outline-none focus:border-ocean-500 transition-colors">
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="bg-white text-ocean-900">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-ocean-600 px-5 py-2 text-sm font-semibold text-white hover:bg-ocean-500 transition-all shadow-md shadow-ocean-500/20">
            เพิ่ม
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500 leading-relaxed font-medium">
          * หมายเหตุ: พนักงานใหม่จะยังไม่มีที่นั่งหมุนเวียนอัตโนมัติจนกว่าจะจองที่นั่งเองครั้งแรก
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md p-6 shadow-xl">
        <h2 className="mb-1 font-bold text-ocean-900 text-lg flex items-center gap-2">
          <span className="w-1.5 h-6 bg-ocean-500 rounded-full inline-block"></span>
          รายชื่อพนักงานทั้งหมด
        </h2>
        <p className="mb-4 text-xs text-slate-500 font-medium">
          * ไม่รวมลีดที่มีที่นั่งประจำ (fixed seat) เนื่องจากไม่ได้ร่วมระบบหมุนเวียน/จองที่นั่ง
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200 bg-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">ชื่อ</th>
                <th className="px-4 py-3 font-semibold">ทีม</th>
                <th className="px-4 py-3 font-semibold">Email (Google login)</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((e) => (
                <EmployeeRow key={e.id} e={e} muted={false} />
              ))}
              {inactiveEmployees.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-100/80 border-t border-slate-200">
                    ปิดใช้งาน ({inactiveEmployees.length})
                  </td>
                </tr>
              )}
              {inactiveEmployees.map((e) => (
                <EmployeeRow key={e.id} e={e} muted={true} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md p-6 shadow-xl">
        <h2 className="mb-4 font-bold text-ocean-900 text-lg flex items-center gap-2">
          <span className="w-1.5 h-6 bg-ocean-500 rounded-full inline-block"></span>
          การจอง/ปล่อยที่นั่ง (override) ของสัปดาห์
        </h2>
        <div className="mb-4">
          <WeekNav basePath="/admin007" weekStart={weekStart} />
        </div>
        {overrides.length === 0 ? (
          <p className="text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">ไม่มี override ในสัปดาห์นี้ (ทุกที่นั่งเป็นค่าอัตโนมัติ)</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200 bg-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">ที่นั่ง</th>
                  <th className="px-4 py-3 font-semibold">สถานะ</th>
                  <th className="px-4 py-3 font-semibold">พนักงาน</th>
                  <th className="px-4 py-3 font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-ocean-50/50 transition-colors">
                    <td className="px-4 py-3 text-ocean-900 font-medium">{o.seat_full_code}</td>
                    <td className="px-4 py-3">
                      {o.status === "booked" ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-ocean-100 text-ocean-700 border border-ocean-200">จองเอง</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">ปล่อยว่าง</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{o.employee_name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <form action={clearOverrideAction}>
                        <input type="hidden" name="seatFullCode" value={o.seat_full_code} />
                        <input type="hidden" name="weekStart" value={o.week_start} />
                        <button className="text-rose-500 hover:text-rose-600 font-semibold hover:underline">ยกเลิก</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
