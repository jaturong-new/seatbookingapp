"use client";

const KEY = "seat_employee_id";
export const IDENTITY_EVENT = "seat-identity-change";

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
