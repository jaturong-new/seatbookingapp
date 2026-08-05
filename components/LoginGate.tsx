"use client";

import { signIn } from "next-auth/react";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

/** Shown instead of any real page content when auth is on and the visitor isn't signed in yet —
 * nothing about seats, teams, or names should be visible pre-login. */
export default function LoginGate() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[2rem] border border-[#04a4cc]/20 bg-[#002836]/80 p-10 text-center shadow-2xl backdrop-blur-md">
      <div className="rounded-2xl bg-[#00222f] p-3 shadow-inner">
        <svg className="h-8 w-8 text-[#44bbdb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-lg font-bold text-white">กรุณา Login ก่อนดูข้อมูล</h1>
      <p className="text-sm text-cyan-200/60">
        ระบบจองที่นั่งนี้จำกัดเฉพาะพนักงาน Ocean Life — เข้าสู่ระบบด้วย Google account บริษัท (@ocean.co.th) เพื่อดูผังที่นั่งและจองที่นั่ง
      </p>
      <button
        onClick={() => signIn("google")}
        className="mt-2 flex items-center gap-2.5 rounded-full border border-[#04a4cc]/30 bg-[#04a4cc]/10 px-5 py-2.5 font-semibold text-white transition-all hover:bg-[#04a4cc]/25 hover:border-[#04a4cc]/50"
      >
        <GoogleIcon />
        Login ด้วย Google บริษัท
      </button>
    </div>
  );
}
