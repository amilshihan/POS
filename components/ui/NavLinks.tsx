"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CASHIER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "New Sale" },
  { href: "/inventory", label: "Inventory" },
  { href: "/customers", label: "Customers" },
  { href: "/cheques", label: "Cheques" },
];

const ADMIN_LINKS = [
  { href: "/suppliers", label: "Suppliers" },
  { href: "/purchases/new", label: "New Purchase" },
  { href: "/reports", label: "Reports" },
  { href: "/users", label: "Staff" },
  { href: "/settings", label: "Settings" },
];

export default function NavLinks({ admin }: { admin: boolean }) {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;
  };

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {CASHIER_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={linkClass(l.href)}>
          {l.label}
        </Link>
      ))}
      {admin && (
        <>
          <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin
          </div>
          {ADMIN_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </>
      )}
    </nav>
  );
}
