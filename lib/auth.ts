import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getEmployeeByEmail } from "./queries";

// Master switch: AUTH_ENABLED=true turns on Google login + first-login claim + server-side
// identity enforcement. Anything else (or unset) = legacy mode: free-form name picker,
// identity trusted from the client, no sign-in required.
export const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

// Restrict sign-in to the company Google Workspace. Set ALLOWED_EMAIL_DOMAIN="" to allow any domain (dev only).
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "ocean.co.th";

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
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (ALLOWED_EMAIL_DOMAIN && !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return false;
      return true;
    },
  },
};

/** The signed-in user's email (lowercased), or null when not signed in / auth disabled. */
export async function getSessionEmail(): Promise<string | null> {
  if (!AUTH_ENABLED) return null;
  const session = await getServerSession(authOptions);
  return session?.user?.email?.toLowerCase() ?? null;
}

/** Resolve the signed-in user to their claimed employee row. Employee is null until they claim a name. */
export async function getSessionEmployee() {
  const email = await getSessionEmail();
  if (!email) return { email: null, employee: null };
  return { email, employee: getEmployeeByEmail(email) ?? null };
}
