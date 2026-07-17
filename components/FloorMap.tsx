"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePersonIdentity } from "./PersonPicker";

type SeatVM = {
  id: number;
  code: string;
  grid_row: number;
  grid_col: number;
  employee: { id: number; name: string; team_name: string } | null;
  source: "booked" | "auto" | "open" | "fixed";
  autoEmployee?: { id: number; name: string; team_name: string } | null;
};

function formatDisplayName(fullName: string): string {
  if (!fullName) return "";
  // Strip nickname in parentheses, e.g. "กิตติพงษ์ (ตี๋)" -> "กิตติพงษ์"
  let name = fullName.replace(/\s*\([^)]+\)/g, "").trim();
  // Strip prefix like "SA : " or "AS400: " or similar
  name = name.replace(/^[A-Za-z0-9\s]+:\s*/, "");
  // Take the first name (before space)
  return name.split(/\s+/)[0];
}

function formatSeatLabel(code: string, source: string): string {
  if (source === "fixed") {
    // If it is a seat code like F5-A2, A2, etc., don't format it
    if (/^[Ff]\d+-[A-Za-z0-9]+$/.test(code) || /^[A-Za-z]\d+$/.test(code)) {
      return code;
    }
    return formatDisplayName(code);
  }
  return code;
}

export default function FloorMap({ seats, weekStart, floorName }: { seats: SeatVM[]; weekStart: string; floorName?: string }) {
  const router = useRouter();
  const employeeId = usePersonIdentity();
  const [pending, setPending] = useState<number | null>(null);
  const [selected, setSelected] = useState<SeatVM | null>(null);

  const { rowCount, colCount, minRow, minCol } = useMemo(() => {
    if (seats.length === 0) return { rowCount: 1, colCount: 1, minRow: 0, minCol: 0 };
    const minRow = Math.min(...seats.map((s) => s.grid_row));
    const minCol = Math.min(...seats.map((s) => s.grid_col));
    const maxRow = Math.max(...seats.map((s) => s.grid_row));
    const maxCol = Math.max(...seats.map((s) => s.grid_col));
    return {
      rowCount: maxRow - minRow + 1,
      colCount: maxCol - minCol + 1,
      minRow,
      minCol,
    };
  }, [seats]);

  async function act(seatId: number, action: "book" | "release" | "clear") {
    setPending(seatId);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, seatId, weekStart, employeeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error === "seat_taken" ? "ที่นั่งนี้ถูกจองไปแล้ว" : data.error === "already_booked" ? "คุณจองที่นั่งอื่นไว้แล้วในสัปดาห์นี้" : "ทำรายการไม่สำเร็จ");
        return;
      }
      setSelected(null);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-5 text-sm font-semibold px-5 py-3.5 bg-[#0a1535]/80 rounded-2xl border border-blue-500/15 shadow-lg backdrop-blur-sm w-fit">
        <Legend swatch="bg-emerald-50 border-emerald-300" label="ว่าง จองได้" />
        <Legend swatch="bg-blue-50 border-blue-200" label="หมุนเวียน (auto)" />
        <Legend swatch="bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600" label="จองเอง (booked)" />
        <Legend swatch="bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300" label="ที่นั่งประจำ (fixed)" />
        {employeeId && <Legend swatch="ring-2 ring-blue-500 bg-white border-slate-200" label="ที่นั่งของฉัน" />}
      </div>

      <div className="overflow-x-auto pb-8">
        <div className="mx-auto w-fit">
          {floorName && (
            <div className="mb-5 rounded-2xl bg-gradient-to-r from-[#101b45] via-[#1b2a6b] to-[#101b45] px-6 py-3.5 text-center text-xl font-extrabold tracking-[0.3em] text-white shadow-lg border border-blue-400/20 uppercase">
              {floorName}
            </div>
          )}
        <div
          className="inline-grid gap-3.5 p-10 rounded-[2rem] border border-slate-200/80 shadow-2xl bg-[radial-gradient(rgba(59,130,246,0.1)_1px,transparent_1px)] [background-size:20px_20px] bg-white"
          style={{
            gridTemplateRows: `repeat(${rowCount}, 5rem)`,
            gridTemplateColumns: `repeat(${colCount}, 7.5rem)`,
          }}
        >
          {seats.map((seat) => {
            if (seat.code.startsWith("Meeting Room")) {
              const colSpan = seat.code.includes("2") ? 3 : 2;
              return (
                <div
                  key={seat.id}
                  style={{
                    gridRow: `${seat.grid_row - minRow + 1} / span 2`,
                    gridColumn: `${seat.grid_col - minCol + 1} / span ${colSpan}`,
                  }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100/70 text-amber-700 shadow-sm select-none cursor-default"
                  title={seat.code}
                >
                  <span className="text-3xl mb-1">🧑‍💼</span>
                  <span className="font-bold text-base">{seat.code}</span>
                </div>
              );
            }

            if (seat.code === "ประตู") {
              return (
                <div
                  key={seat.id}
                  style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-gradient-to-b from-rose-700 to-rose-900 border border-rose-800 text-white shadow-md"
                  title="ประตูทางเข้า"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-1 text-rose-100">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  <span className="font-bold text-xs tracking-wide text-rose-50">ประตูทางเข้า</span>
                </div>
              );
            }

            if (seat.code.toLowerCase().includes("locker")) {
              return (
                <div
                  key={seat.id}
                  style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm font-semibold text-xs leading-tight select-none cursor-default"
                  title={seat.code}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 text-emerald-600">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                  </svg>
                  <span className="truncate w-full text-center px-0.5 text-emerald-700 font-bold text-[11px]">{seat.code}</span>
                </div>
              );
            }

            if (seat.code.toLowerCase().startsWith("ext")) {
              return (
                <div
                  key={seat.id}
                  style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 shadow-sm font-medium text-xs leading-tight select-none cursor-default"
                  title={seat.code}
                >
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">EXT</span>
                  <span className="font-bold text-slate-700 text-[10px]">{seat.code.replace(/ext\.?/i, "").trim()}</span>
                </div>
              );
            }
            if (seat.code === "ไม่มีที่นั่ง") {
              return (
                <div
                  key={seat.id}
                  style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-400 border border-slate-500 text-white shadow-sm font-semibold text-xs leading-tight select-none cursor-default"
                  title="ไม่มีที่นั่ง"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 text-slate-100">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span className="text-[11px] text-slate-100 font-bold">ไม่มีที่นั่ง</span>
                </div>
              );
            }

            const displayLabel = formatSeatLabel(seat.code, seat.source);

            if (seat.source === "fixed") {
              return (
                <div
                  key={seat.id}
                  style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                  className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-amber-300 text-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/80 shadow-sm opacity-90 px-2 text-center text-xs leading-tight select-none cursor-default"
                  title={`${seat.code} (ที่นั่งประจำ)`}
                >
                  <span className="font-semibold mb-0.5 text-amber-700">🔒 {displayLabel}</span>
                  <span className="truncate w-full font-medium text-amber-600/70">ประจำ</span>
                </div>
              );
            }

            const isMine = employeeId != null && seat.employee?.id === employeeId;
            const base =
              seat.source === "booked"
                ? "bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600 text-white shadow-md hover:from-blue-600 hover:to-blue-800 hover:-translate-y-1 hover:shadow-blue-500/20"
                : seat.source === "auto"
                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm hover:bg-blue-100 hover:text-blue-900 hover:-translate-y-1"
                : "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 hover:-translate-y-1";

            const employeeName = seat.employee ? formatDisplayName(seat.employee.name) : "ว่าง";

            return (
              <button
                key={seat.id}
                onClick={() => setSelected(seat)}
                disabled={pending === seat.id}
                style={{ gridRow: seat.grid_row - minRow + 1, gridColumn: seat.grid_col - minCol + 1 }}
                className={`flex h-full w-full flex-col items-center justify-center rounded-2xl border transition-all duration-300 px-2 text-center text-sm leading-tight ${base} ${
                  isMine ? "ring-2 ring-sunset-500 shadow-lg shadow-sunset-500/30 z-10" : ""
                } ${pending === seat.id ? "opacity-50 scale-95" : ""}`}
                title={seat.code}
              >
                <span className={`font-bold mb-1 text-base ${
                  seat.source === 'booked' ? 'text-white' :
                  seat.source === 'auto' ? 'text-blue-700' :
                  'text-emerald-700'
                }`}>{displayLabel}</span>
                <span className={`truncate w-full font-medium ${
                  seat.source === 'open' ? 'text-emerald-500 italic' : ''
                }`}>{employeeName}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#03091e]/80 backdrop-blur-sm p-4 animate-fade-in-up" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#081228] border border-blue-500/20 p-6 shadow-2xl transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-white">ที่นั่ง <span className="text-blue-300">{selected.code}</span></h3>
              <button onClick={() => setSelected(null)} className="text-blue-400/60 hover:text-white p-1">✕</button>
            </div>

            <div className="mb-6 rounded-lg bg-[#0d2060]/40 p-4 border border-blue-500/10">
              {selected.source === "fixed" ? (
                <p className="font-medium text-amber-400 py-2 text-center text-lg">ที่นั่งประจำ (Fixed Seat)<br/><span className="text-sm font-normal mt-1 block text-blue-400/60">ไม่สามารถจองที่นั่งนี้ได้</span></p>
              ) : selected.employee ? (
                <>
                  <p className="font-semibold text-white text-lg mb-1">{selected.employee.name}</p>
                  <p className="text-sm text-blue-300/60 mb-2">ทีม: {selected.employee.team_name}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    selected.source === "booked" ? "bg-blue-500/20 text-blue-200 border border-blue-500/30" : "bg-[#0d2060]/60 text-blue-300 border border-blue-700/30"
                  }`}>
                    {selected.source === "booked" ? "จองด้วยตัวเอง" : "ระบบหมุนเวียนอัตโนมัติ"}
                  </span>
                </>
              ) : (
                <p className="font-medium text-blue-400/60 py-2 text-center">ที่นั่งว่าง</p>
              )}
            </div>

            {!employeeId && <p className="mb-4 text-sm font-medium text-amber-300 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">⚠️ โปรดเลือกชื่อตัวเองที่มุมขวาบนก่อนจอง/ปล่อยที่นั่ง</p>}

            <div className="flex flex-col gap-2">
              {employeeId && !selected.employee && selected.source !== "fixed" && (
                <button
                  onClick={() => act(selected.id, "book")}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-blue-950/40 transition-all hover:bg-blue-500 hover:shadow-lg focus:ring-4 focus:ring-blue-500/20"
                >
                  จองที่นั่งนี้
                </button>
              )}
              {employeeId && selected.source === "auto" && selected.employee?.id === employeeId && (
                <button
                  onClick={() => act(selected.id, "release")}
                  className="rounded-xl bg-rose-500 px-4 py-2.5 font-semibold text-white shadow-md shadow-rose-500/20 transition-all hover:bg-rose-600 hover:shadow-lg focus:ring-4 focus:ring-rose-400/20"
                >
                  ปล่อยที่นั่งนี้ (ไม่เข้าออฟฟิศ)
                </button>
              )}
              {employeeId && (
                ((selected.source === "booked" && selected.employee?.id === employeeId) ||
                 (selected.employee === null && selected.autoEmployee?.id === employeeId))
              ) && (
                <button
                  onClick={() => act(selected.id, "clear")}
                  className="rounded-xl bg-[#0a1535] border border-blue-500/20 px-4 py-2.5 font-semibold text-blue-300 transition-all hover:bg-[#0d1e4a] focus:ring-4 focus:ring-blue-500/20"
                >
                  ยกเลิกการจอง/ปล่อย (กลับสู่ค่าอัตโนมัติ)
                </button>
              )}
              <button onClick={() => setSelected(null)} className="rounded-xl border border-blue-500/20 px-4 py-2.5 font-medium text-blue-400/60 transition-all hover:bg-[#0a1535] hover:text-blue-300">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-4 w-4 rounded-md border ${swatch}`} />
      <span className="text-blue-300/70">{label}</span>
    </div>
  );
}
