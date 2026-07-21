"use client";

export const IDENTITY_EVENT = "seat-identity-change";

export type EmployeeOption = { id: number; name: string; team_name: string };

/** Identity has two modes, switched by the server's AUTH_ENABLED flag (reported via /api/me):
 * - authEnabled: false → legacy mode: pick any name, stored in localStorage below
 * - authEnabled: true  → Google session + one-time claim; client identity comes from /api/me */
export type Me =
  | { authEnabled: false }
  | { authEnabled: true; signedIn: false }
  | { authEnabled: true; signedIn: true; email: string; employee: EmployeeOption | null; unclaimed?: EmployeeOption[] };

// ── legacy localStorage identity (used only when auth is disabled) ──────────

const KEY = "seat_employee_id";

export function getStoredEmployeeId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? Number(raw) : null;
}

export function setStoredEmployeeId(id: number | null) {
  if (typeof window === "undefined") return;
  if (id == null) {
    window.localStorage.removeItem(KEY);
  } else {
    window.localStorage.setItem(KEY, String(id));
  }
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: id }));
}

// ── session-backed identity (used when auth is enabled) ─────────────────────

let cache: Me | null = null;
let inflight: Promise<Me> | null = null;

/** Cached per page-load; call invalidateMe() after claim/sign-out so every listener refetches. */
export function fetchMe(force = false): Promise<Me> {
  if (!force && cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/me")
      .then((r) => r.json() as Promise<Me>)
      .then((me) => {
        cache = me;
        return me;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateMe() {
  cache = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT));
  }
}
