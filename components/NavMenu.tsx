"use client";

import { useState } from "react";
import Link from "next/link";

/** Compact "Label ▾" nav button that opens a dropdown of links — keeps the header to a fixed
 * width no matter how many floors/teams exist, instead of spelling every one out as a pill. */
export default function NavMenu({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-cyan-100 transition-all hover:bg-[#04a4cc]/15 hover:text-white whitespace-nowrap"
      >
        {label}
        <svg
          className={`w-3 h-3 shrink-0 text-cyan-200/50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 min-w-[9rem] rounded-2xl border border-[#04a4cc]/25 bg-[#00222f] p-1.5 shadow-2xl">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-cyan-100 whitespace-nowrap hover:bg-[#04a4cc]/15 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
