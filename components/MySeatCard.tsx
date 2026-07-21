"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePersonIdentity } from "./PersonPicker";

type MySeatResponse = {
  employee: { id: number; name: string; team_name: string };
  week: string;
  seat: { id: number; code: string; source: "booked" | "auto" | "fixed" } | { source: "wfh" } | null;
  floor: { code: string; name: string } | null;
};

export default function MySeatCard({ weekStart }: { weekStart: string }) {
  const employeeId = usePersonIdentity();
  const [data, setData] = useState<MySeatResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/my-seat?employeeId=${employeeId}&week=${weekStart}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error("Failed to fetch");
        }
        return r.json();
      })
      .then(setData)
      .catch(() => setData({ error: "not_found" } as any))
      .finally(() => setLoading(false));
  }, [employeeId, weekStart]);

  if (!employeeId || (data && "error" in data)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
        👆 โปรดระบุตัวตนของคุณด้านบน เพื่อดูสถานะที่นั่งในสัปดาห์นี้
      </div>
    );
  }

  if (loading || !data) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500 animate-pulse">กำลังโหลดข้อมูลของคุณ...</div>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-lg">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ocean-50 text-ocean-600 font-bold text-xl border border-ocean-200">
          {data.employee.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-ocean-900">{data.employee.name}</h2>
          <p className="text-sm font-medium text-slate-500">ทีม {data.employee.team_name}</p>
        </div>
      </div>

      {data.seat && data.seat.source === "wfh" ? (
        <div className="rounded-xl bg-emerald-50 p-6 text-center border border-emerald-200">
          <div className="text-3xl mb-2">🏡</div>
          <p className="text-lg font-bold text-emerald-600">สัปดาห์นี้เป็นคิว WFH ของคุณ</p>
          <p className="text-sm font-medium text-emerald-500/80 mt-1">ไม่ต้องเข้าออฟฟิศ</p>
        </div>
      ) : data.seat && data.floor && "code" in data.seat ? (
        <div className="rounded-xl bg-ocean-50 p-6 border border-ocean-200 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-ocean-900">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-ocean-600 uppercase tracking-widest mb-1">ที่นั่งของคุณ</p>
            <p className="text-4xl md:text-5xl font-black text-ocean-900 tracking-tight">
              {data.floor.code}-{data.seat.code}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                data.seat.source === 'booked' ? 'bg-ocean-100 text-ocean-700 border border-ocean-200' :
                data.seat.source === 'fixed' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                'bg-slate-100 text-slate-500'
              }`}>
                {data.seat.source === "booked" ? "จองด้วยตัวเอง" :
                 data.seat.source === "fixed" ? "ที่นั่งประจำ" :
                 "ระบบหมุนเวียนอัตโนมัติ"}
              </span>
              <span className="text-sm font-medium text-slate-500">สัปดาห์ {data.week}</span>
            </div>
          </div>

          <Link href={`/floor/${data.floor.code}?week=${data.week}`} className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-ocean-600 shadow-sm transition-all hover:bg-ocean-600 hover:text-white hover:shadow-md z-10 w-full md:w-auto text-center border border-ocean-200">
            ดูผังชั้น {data.floor.name} &rarr;
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-6 text-center">
          <div className="text-2xl mb-2">🪑</div>
          <p className="text-base font-semibold text-amber-600">ยังไม่มีที่นั่งถูกจัดสรรในสัปดาห์นี้</p>
          <p className="text-sm text-amber-500/80 mt-1 mb-4">คุณสามารถเลือกจองที่นั่งที่ว่างอยู่ได้ด้วยตัวเอง</p>
          <Link href="/floor/F5" className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-bold text-amber-600 shadow-sm transition-all hover:bg-amber-500 hover:text-white border border-amber-200">
            ไปที่ผังที่นั่ง &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
