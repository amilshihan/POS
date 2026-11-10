"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ALL_MENU_ITEMS, type MenuItem } from "@/lib/menuItems";
import type { MenuPermissionRow } from "@/lib/permissions";

// "My Profile" lives in the top-right header instead of the sidebar now.
const CASHIER_LINKS = ALL_MENU_ITEMS.filter((l) => l.section === "cashier" && l.href !== "/profile");
const WORKSHOP_LINKS = ALL_MENU_ITEMS.filter((l) => l.section === "workshop");
const ADMIN_LINKS = ALL_MENU_ITEMS.filter((l) => l.section === "admin");

const COLLAPSE_STORAGE_KEY = "nav-collapsed-sections";

type SectionKey = "general" | "workshop" | "admin";

function isLinkEnabled(permissions: MenuPermissionRow[], role: string, href: string): boolean {
  if (href === "/dashboard" || href === "/profile") return true;
  if (href === "/settings" && role === "admin") return true;
  const row = permissions.find((p) => p.role === role && p.path === href);
  return row ? row.enabled : true;
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`}
    >
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

export default function NavLinks({
  role,
  permissions,
}: {
  role: string;
  permissions: MenuPermissionRow[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    general: false,
    workshop: false,
    admin: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved) setCollapsed((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      // ignore unavailable/corrupt storage
    }
  }, []);

  function toggleSection(key: SectionKey) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore unavailable storage
      }
      return next;
    });
  }

  const visible = (links: MenuItem[]) => links.filter((l) => isLinkEnabled(permissions, role, l.href));

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;
  };

  const cashierLinks = visible(CASHIER_LINKS);
  const workshopLinks = visible(WORKSHOP_LINKS);
  const adminLinks = visible(ADMIN_LINKS);

  const sectionHeaderClass =
    "flex w-full items-center justify-between pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300";

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {cashierLinks.length > 0 && (
        <>
          <button type="button" onClick={() => toggleSection("general")} className={sectionHeaderClass}>
            <span>General</span>
            <ChevronIcon collapsed={collapsed.general} />
          </button>
          {!collapsed.general &&
            cashierLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
        </>
      )}
      {workshopLinks.length > 0 && (
        <>
          <button type="button" onClick={() => toggleSection("workshop")} className={sectionHeaderClass}>
            <span>Workshop</span>
            <ChevronIcon collapsed={collapsed.workshop} />
          </button>
          {!collapsed.workshop &&
            workshopLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
        </>
      )}
      {adminLinks.length > 0 && (
        <>
          <button type="button" onClick={() => toggleSection("admin")} className={sectionHeaderClass}>
            <span>Admin</span>
            <ChevronIcon collapsed={collapsed.admin} />
          </button>
          {!collapsed.admin &&
            adminLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
        </>
      )}
    </nav>
  );
}
