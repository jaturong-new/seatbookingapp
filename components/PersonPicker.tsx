"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import {
  fetchMe,
  invalidateMe,
  getStoredEmployeeId,
  setStoredEmployeeId,
  IDENTITY_EVENT,
  type Me,
  type EmployeeOption,
} from "@/lib/identity";

export function useMe(): { me: Me | null; refresh: () => void } {
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(() => {
    fetchMe(true).then(setMe);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchMe().then((m) => mounted && setMe(m));
    const handler = () => fetchMe().then((m) => mounted && setMe(m));
    window.addEventListener(IDENTITY_EVENT, handler);
    return () => {
      mounted = false;
      window.removeEventListener(IDENTITY_EVENT, handler);
    };
  }, []);

  return { me, refresh };
}

/** The current user's employee id, or null. Auth mode: the claimed employee from the session.
 * Legacy mode: whatever name they picked (localStorage), as before. */
export function usePersonIdentity(): number | null {
  const { me } = useMe();
  const [localId, setLocalId] = useState<number | null>(null);

  useEffect(() => {
    setLocalId(getStoredEmployeeId());
    const handler = () => setLocalId(getStoredEmployeeId());
    window.addEventListener(IDENTITY_EVENT, handler);
    return () => window.removeEventListener(IDENTITY_EVENT, handler);
  }, []);

  if (!me) return null;
  if (!me.authEnabled) return localId;
  return me.signedIn ? (me.employee?.id ?? null) : null;
}

const pillClass = (ok: boolean) =>
  `flex shrink-0 items-center gap-2 sm:gap-3 rounded-full border px-3 sm:px-4 py-2 sm:py-2.5 shadow-md transition-all backdrop-blur max-w-full ${
    ok ? "border-[#04a4cc]/25 bg-[#002836]/80" : "border-amber-500/40 bg-amber-500/10"
  }`;

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

/** Legacy picker (auth disabled): freely select any active name, stored in localStorage. */
function LegacyPicker() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const employeeId = usePersonIdentity();

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then(setEmployees);
  }, []);

  return (
    <div className={`${pillClass(!!employeeId)} focus-within:ring-2 focus-within:ring-[#04a4cc]/40 focus-within:border-transparent`}>
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

export default function PersonPicker() {
  const { me, refresh } = useMe();
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function claim() {
    if (!selectedId) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setClaimError(
          data.error === "name_taken"
            ? "ชื่อนี้ถูกผูกกับ email อื่นไปแล้ว"
            : data.error === "email_taken" || data.error === "already_claimed"
            ? "email ของคุณถูกผูกกับชื่ออื่นไปแล้ว"
            : "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง"
        );
        return;
      }
      invalidateMe();
      refresh();
    } finally {
      setClaiming(false);
    }
  }

  // loading
  if (!me) {
    return (
      <div className={pillClass(true)}>
        <span className="text-xs sm:text-sm text-cyan-200/50 animate-pulse whitespace-nowrap">กำลังตรวจสอบตัวตน...</span>
      </div>
    );
  }

  // auth disabled → original free-form picker
  if (!me.authEnabled) {
    return <LegacyPicker />;
  }

  // not signed in
  if (!me.signedIn) {
    return (
      <button onClick={() => signIn("google")} className={`${pillClass(false)} cursor-pointer hover:bg-amber-500/20`}>
        <GoogleIcon />
        <span className="text-xs sm:text-sm font-semibold text-amber-200 whitespace-nowrap">Login ด้วย Google บริษัท</span>
      </button>
    );
  }

  // signed in, not yet mapped to a name → one-time claim
  if (!me.employee) {
    const options: EmployeeOption[] = me.unclaimed ?? [];
    return (
      <div className="flex flex-col gap-1 max-w-full">
        <div className={pillClass(false)}>
          <span className="shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium text-amber-300">ครั้งแรก — เลือกชื่อของคุณ:</span>
          <select
            className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm font-semibold text-white outline-none cursor-pointer"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="" className="bg-[#00222f] text-cyan-200/60">-- เลือกชื่อ --</option>
            {options.map((e) => (
              <option key={e.id} value={e.id} className="bg-[#00222f] text-white">
                {e.name} ({e.team_name})
              </option>
            ))}
          </select>
          <button
            onClick={claim}
            disabled={!selectedId || claiming}
            className="shrink-0 rounded-full bg-[#04a4cc] px-3 py-1 text-xs sm:text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#44bbdb] transition-colors"
          >
            {claiming ? "กำลังผูก..." : "ยืนยัน"}
          </button>
        </div>
        <p className="text-[10px] sm:text-xs text-amber-300/80 px-3">
          {claimError ?? `จะผูกชื่อกับ ${me.email} ถาวร — เลือกได้ครั้งเดียว (แก้ได้โดย admin)`}
        </p>
      </div>
    );
  }

  // signed in + mapped
  return (
    <div className={pillClass(true)}>
      <svg className="w-4 h-4 shrink-0 text-cyan-300/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span className="min-w-0 truncate text-xs sm:text-sm font-semibold text-white" title={me.email}>
        {me.employee.name} <span className="text-cyan-200/60 font-normal">({me.employee.team_name})</span>
      </span>
      <button
        onClick={() => signOut()}
        className="shrink-0 whitespace-nowrap text-[10px] sm:text-xs font-medium text-cyan-200/50 hover:text-rose-300 transition-colors"
        title={`ออกจากระบบ (${me.email})`}
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
