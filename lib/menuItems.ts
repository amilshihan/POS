// Canonical list of every item in the sidebar nav, shared between the nav
// itself, the Settings → Permissions tab, and the access check in
// lib/supabase/middleware.ts, so all three always agree on what exists.
export type MenuSection = "cashier" | "workshop" | "admin";

export type MenuItem = {
  href: string;
  label: string;
  section: MenuSection;
};

export const ALL_MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", section: "cashier" },
  { href: "/pos", label: "New Sale", section: "cashier" },
  { href: "/invoices", label: "Invoices", section: "cashier" },
  { href: "/inventory", label: "Products", section: "cashier" },
  { href: "/customers", label: "Customers", section: "cashier" },
  { href: "/vehicles", label: "Vehicle", section: "cashier" },
  { href: "/cheques", label: "Cheques", section: "cashier" },
  { href: "/profile", label: "My Profile", section: "cashier" },
  { href: "/workshop/job-cards", label: "Work Orders", section: "workshop" },
  { href: "/workshop/service-types", label: "Service Types", section: "workshop" },
  { href: "/workshop/master-data", label: "Master Data (Vehicles)", section: "workshop" },
  { href: "/packages", label: "Packages", section: "admin" },
  { href: "/suppliers", label: "Suppliers", section: "admin" },
  { href: "/purchases", label: "Purchases", section: "admin" },
  { href: "/purchases/new", label: "New Purchase", section: "admin" },
  { href: "/expenses", label: "Expenses", section: "admin" },
  { href: "/reports", label: "Reports", section: "admin" },
  { href: "/finance", label: "Finance", section: "admin" },
  { href: "/promo", label: "Promo Images", section: "admin" },
  { href: "/users", label: "Staff", section: "admin" },
  { href: "/settings", label: "Settings", section: "admin" },
];

// Longest-prefix match so e.g. "/purchases/new" wins over "/purchases" for
// its own URL, and a sub-route like "/vehicles/123" still maps back to
// "/vehicles".
export function findMenuItem(pathname: string): MenuItem | null {
  let best: MenuItem | null = null;
  for (const item of ALL_MENU_ITEMS) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
