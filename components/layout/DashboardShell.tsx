"use client";

import { useState } from "react";
import SignOutButton from "@/components/ui/SignOutButton";
import NavLinks from "@/components/ui/NavLinks";

const DESKTOP_BREAKPOINT = 1024;

export default function DashboardShell({
  admin,
  displayName,
  children,
}: {
  admin: boolean;
  displayName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT) {
      setDesktopCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-4 py-3">
        <button
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          className="p-1 -ml-1 rounded hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-bold">Spare Parts POS</span>
      </div>

      <div className="flex">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } ${desktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0 lg:static lg:z-auto"}`}
        >
          <div className="px-5 py-5 border-b border-slate-800 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-white text-lg">Spare Parts POS</div>
              <div className="text-xs text-slate-400 mt-0.5">{displayName}</div>
            </div>
            <button
              onClick={toggleSidebar}
              aria-label="Collapse menu"
              className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div onClick={() => setMobileOpen(false)} className="flex-1 min-h-0 flex flex-col">
            <NavLinks admin={admin} />
          </div>
          <div className="mt-auto p-4 border-t border-slate-800">
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
