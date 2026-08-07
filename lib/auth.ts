import fs from "fs";
import path from "path";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getEmployeeByEmail, tryAutoClaimByName } from "./queries";

// Master switch: AUTH_ENABLED=true turns on Google login + first-login claim + server-side
// identity enforcement. Anything else (or unset) = legacy mode: free-form name picker,
// identity trusted from the client, no sign-in required.
export const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

// Restrict sign-in to the company Google Workspace. Set ALLOWED_EMAIL_DOMAIN="" to allow any domain (dev only).
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "ocean.co.th";

const WHITELIST_FILE = path.join(process.cwd(), "data", "login_whitelist.json");

let loginWhitelistCache: Set<string> | null = null;

/** The people allowed to use the app. The company domain on its own is far too wide — the whole
 * of @ocean.co.th is not on this seat roster — so this list, not ALLOWED_EMAIL_DOMAIN, is the
 * real gate; the domain check just stays as a cheap outer guard.
 *
 * Kept as a plain JSON file (`data/login_whitelist.json`, email -> role) rather than a table, so
 * adding or removing someone is a one-file edit and never means shipping a new database over the
 * live one. The role is recorded for provenance only; nothing reads it yet.
 *
 * Read once per process, like the other data/*.json caches — editing the file takes effect on the
 * next restart (`docker compose restart seatbooking`), not immediately. */
function loginWhitelist(): Set<string> {
  if (loginWhitelistCache) return loginWhitelistCache;
  let emails: string[] = [];
  try {
    const doc = JSON.parse(fs.readFileSync(WHITELIST_FILE, "utf-8")) as {
      emails: Record<string, string>;
    };
    emails = Object.keys(doc.emails ?? {});
  } catch (err) {
    // Fail closed, loudly: a missing or malformed list must lock everyone out rather than fall
    // back to "anyone with a company address", which is exactly what this list exists to prevent.
    console.error(`[auth] cannot read ${WHITELIST_FILE} — all sign-ins will be rejected`, err);
  }
  loginWhitelistCache = new Set(emails.map((e) => e.trim().toLowerCase()));
  return loginWhitelistCache;
}

/** Whether this Google account may use the app at all. Checked at sign-in *and* on every
 * subsequent request (see getSessionEmail) — sessions are JWTs valid for weeks, so a list-only
 * sign-in check would leave someone removed from the list still holding a working session. */
export function isLoginAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (ALLOWED_EMAIL_DOMAIN && !lower.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return false;
  return loginWhitelist().has(lower);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
          // hd only pre-filters Google's account chooser — real enforcement is in signIn below
          ...(ALLOWED_EMAIL_DOMAIN ? { hd: ALLOWED_EMAIL_DOMAIN } : {}),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return isLoginAllowed(user.email);
    },
  },
};

/** The signed-in user's email (lowercased), or null when not signed in / auth disabled.
 * Also null once the account drops off the whitelist, so removing someone takes effect on their
 * very next request instead of whenever their JWT happens to expire. Every page and API route
 * funnels through here, so this one check covers all of them. */
export async function getSessionEmail(): Promise<string | null> {
  if (!AUTH_ENABLED) return null;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  return isLoginAllowed(email) ? email : null;
}

/** Email + Google account display name (e.g. "Chatnarin Akkharathananon - ฉัตรนรินทร์ อัครธนานนท์"),
 * used to greet the user and to pre-match them against the unclaimed roster on first login. */
export async function getSessionUser(): Promise<{ email: string | null; name: string | null }> {
  if (!AUTH_ENABLED) return { email: null, name: null };
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!isLoginAllowed(email)) return { email: null, name: null };
  return { email, name: session?.user?.name ?? null };
}

/** Resolve the signed-in user to their claimed employee row. On the very first call for a
 * not-yet-claimed account, tries the Google display name against the unclaimed roster before
 * giving up — most accounts resolve right here with no manual claim step at all; every call
 * after that just hits the email match above once the row is bound. */
export async function getSessionEmployee() {
  const email = await getSessionEmail();
  if (!email) return { email: null, employee: null };
  let employee = getEmployeeByEmail(email) ?? null;
  if (!employee) {
    const { name } = await getSessionUser();
    employee = tryAutoClaimByName(email, name) ?? null;
  }
  return { email, employee };
}

export type ResolvedEmployee =
  | { ok: true; employeeId: number }
  | { ok: false; status: number; error: string };

/** Resolve which employee a per-person read is about.
 *
 * With auth on, the answer comes from the session and nowhere else: a client-supplied employeeId
 * is only ever accepted as a *match check*, never as the lookup key, so nobody can read another
 * person's row by walking ids. Legacy mode (auth off) has no session at all, so the client's id
 * is the only identity there is — same trust model as the rest of that mode. */
export async function resolveRequestedEmployeeId(requestedId: number | null): Promise<ResolvedEmployee> {
  if (!AUTH_ENABLED) {
    if (!requestedId) return { ok: false, status: 400, error: "employeeId required" };
    return { ok: true, employeeId: requestedId };
  }
  const { email, employee } = await getSessionEmployee();
  if (!email) return { ok: false, status: 401, error: "unauthorized" };
  if (!employee) return { ok: false, status: 403, error: "not_mapped" };
  if (requestedId && requestedId !== employee.id) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, employeeId: employee.id };
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Admin gate: when auth is on, only the Google accounts listed in ADMIN_EMAILS may pass (used
 * by both the /admin007 page and its API routes, e.g. the DB export below). An unset/empty
 * ADMIN_EMAILS closes access rather than opening it — /admin007 lists every employee's email and
 * can rebind them, and the DB export hands out the whole database, so a missing config must
 * never be the thing that hands either to any signed-in user. Auth off = legacy mode, open as
 * before (no session to gate on). */
export async function assertAdmin(): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  const allowed = adminEmails();
  if (allowed.length === 0) return false;
  const email = await getSessionEmail();
  return !!email && allowed.includes(email);
}

/** Whether the current request may see app data at all: always true in legacy mode (auth off),
 * otherwise only once signed in with a company account — claiming a name is a separate step,
 * not required just to browse the seat map. Pages/routes call this before rendering any data. */
export async function hasReadAccess(): Promise<boolean> {
  if (!AUTH_ENABLED) return true;
  return (await getSessionEmail()) !== null;
}
