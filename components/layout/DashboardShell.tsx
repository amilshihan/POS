"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "@/components/ui/SignOutButton";
import NavLinks from "@/components/ui/NavLinks";
import type { MenuPermissionRow } from "@/lib/permissions";

const DESKTOP_BREAKPOINT = 1024;

export default function DashboardShell({
  role,
  permissions,
  displayName,
  children,
}: {
  role: string;
  permissions: MenuPermissionRow[];
  displayName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    setConfirmSignOut(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
        <div className="relative ml-auto">
          <button
            onClick={() => setProfileMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={profileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-white hover:bg-slate-600 transition"
          >
            {displayName.trim().charAt(0) || "?"}
          </button>
          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-white text-slate-700 shadow-lg border border-slate-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-sm font-medium text-slate-900 truncate">{displayName}</div>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  My Profile
                </Link>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setConfirmSignOut(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmSignOut && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmSignOut(false);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg text-slate-900">Sign out?</h2>
            <p className="text-sm text-slate-500">You&apos;ll need to log in again to access your account.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

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
          } ${desktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
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
            <NavLinks role={role} permissions={permissions} />
          </div>
          <div className="mt-auto p-4 border-t border-slate-800">
            <SignOutButton />
          </div>
        </aside>

        <main className={`flex-1 min-w-0 transition-[margin] duration-200 ease-out ${desktopCollapsed ? "lg:ml-0" : "lg:ml-60"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
