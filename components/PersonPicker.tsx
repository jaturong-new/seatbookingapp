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
    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/70 backdrop-blur px-4 py-2.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-ocean-500 focus-within:border-transparent">
      <label className="text-sm font-medium text-slate-500 flex items-center gap-1.5" htmlFor="person-picker">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        ระบุตัวตน:
      </label>
      <select
        id="person-picker"
        className="bg-transparent text-sm font-semibold text-ocean-900 outline-none cursor-pointer pr-4"
        value={employeeId ?? ""}
        onChange={(e) => setStoredEmployeeId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="" className="bg-white text-slate-400">-- กรุณาเลือกชื่อของคุณ --</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id} className="bg-white text-ocean-900">
            {e.name} ({e.team_name})
          </option>
        ))}
      </select>
    </div>
  );
}
