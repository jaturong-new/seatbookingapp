import MySeatCard from "@/components/MySeatCard";
import WeekNav from "@/components/WeekNav";
import LoginGate from "@/components/LoginGate";
import { weekStartOf, clampToFirstWeek } from "@/lib/rotation";
import { hasReadAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({ searchParams }: { searchParams: { week?: string } }) {
  if (!(await hasReadAccess())) return <LoginGate />;

  const weekStart = clampToFirstWeek(searchParams.week ?? weekStartOf(new Date()));

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 max-w-4xl mx-auto">
      <div className="mb-8 pb-6 border-b border-slate-100">
        <span className="text-xs uppercase tracking-widest font-extrabold bg-ocean-50 text-ocean-600 px-3 py-1.5 rounded-full inline-block mb-3 border border-ocean-200 shadow-sm">
          แดชบอร์ดส่วนตัว
        </span>
        <h1 className="text-3xl font-extrabold text-ocean-900 tracking-tight">ที่นั่งของฉัน</h1>
        <p className="text-slate-500 mt-1.5 font-medium">จัดการการจองที่นั่งของคุณและเช็คตารางสัปดาห์นี้</p>
      </div>
      <div className="mb-8">
        <WeekNav basePath="/" weekStart={weekStart} />
      </div>
      <MySeatCard weekStart={weekStart} />
      <div className="mt-8 rounded-2xl bg-ocean-50/60 p-5 border border-ocean-100 flex items-start gap-4 shadow-inner">
        <div className="text-2xl bg-white p-2 rounded-xl shadow-sm border border-slate-200">💡</div>
        <p className="text-sm text-slate-600 leading-relaxed font-medium">
          <strong className="text-ocean-900">คำแนะนำ:</strong> ดูผังที่นั่งทั้งชั้นหรือรายทีมได้จากเมนูด้านบน คลิกที่นั่งในผังเพื่อจอง/ปล่อยที่นั่งของสัปดาห์นั้น
        </p>
      </div>
    </div>
  );
}
