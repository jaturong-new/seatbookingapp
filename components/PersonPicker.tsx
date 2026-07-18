"use client";

import { useEffect, useState } from "react";
import { getStoredEmployeeId, setStoredEmployeeId, IDENTITY_EVENT } from "@/lib/identity";

type EmployeeOption = { id: number; name: string; team_name: string };

export function usePersonIdentity() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  useEffect(() => {
    setEmployeeId(getStoredEmployeeId());
    const handler = (e: Event) => setEmployeeId((e as CustomEvent<number | null>).detail);
    window.addEventListener(IDENTITY_EVENT, handler);
    return () => window.removeEventListener(IDENTITY_EVENT, handler);
  }, []);

  return employeeId;
}

export default function PersonPicker() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const employeeId = usePersonIdentity();

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then(setEmployees);
  }, []);

  return (
    <div className={`flex shrink-0 items-center gap-2 sm:gap-3 rounded-full border px-3 sm:px-4 py-2 sm:py-2.5 shadow-md transition-all backdrop-blur focus-within:ring-2 focus-within:ring-[#04a4cc]/40 focus-within:border-transparent max-w-full ${
      employeeId ? "border-[#04a4cc]/25 bg-[#002836]/80" : "border-amber-500/40 bg-amber-500/10"
    }`}>
      <label className={`shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 ${employeeId ? "text-cyan-200/70" : "text-amber-300"}`} htmlFor="person-picker">
        <svg className={`w-4 h-4 shrink-0 ${employeeId ? "text-cyan-300/60" : "text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="hidden sm:inline">ระบุตัวตน:</span>
      </label>
      <select
        id="person-picker"
        className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm font-semibold text-white outline-none cursor-pointer pr-2 sm:pr-4"
        value={employeeId ?? ""}
        onChange={(e) => setStoredEmployeeId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="" className="bg-[#00222f] text-cyan-200/60">-- กรุณาเลือกชื่อของคุณ --</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id} className="bg-[#00222f] text-white">
            {e.name} ({e.team_name})
          </option>
        ))}
      </select>
    </div>
  );
}
