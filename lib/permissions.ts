import type { Profile, UserRole } from "@/lib/database.types";
import { findMenuItem } from "@/lib/menuItems";

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin" && profile.is_active;
}

export const ADMIN_ONLY_PATHS = ["/suppliers", "/purchases", "/reports", "/users", "/settings", "/promo"];

export function canAccessPath(profile: Profile | null | undefined, pathname: string): boolean {
  if (isAdmin(profile)) return true;
  return !ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p));
}

export type MenuPermissionRow = { role: UserRole; path: string; enabled: boolean };

// Stays reachable for every active user no matter what's toggled off in
// Settings → Permissions, so nobody — including Admin — can lock
// themselves out of the app or of the screen that fixes permissions.
function isAlwaysEnabled(role: UserRole, menuHref: string): boolean {
  if (menuHref === "/dashboard" || menuHref === "/profile") return true;
  if (menuHref === "/settings" && role === "admin") return true;
  return false;
}

export function isMenuPathEnabled(
  overrides: MenuPermissionRow[],
  role: UserRole,
  pathname: string
): boolean {
  const item = findMenuItem(pathname);
  if (!item) return true;
  if (isAlwaysEnabled(role, item.href)) return true;
  const row = overrides.find((o) => o.role === role && o.path === item.href);
  return row ? row.enabled : true;
}
