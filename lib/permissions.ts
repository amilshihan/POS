import type { Profile } from "@/lib/database.types";

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin" && profile.is_active;
}

export const ADMIN_ONLY_PATHS = ["/suppliers", "/purchases", "/reports", "/users", "/settings"];

export function canAccessPath(profile: Profile | null | undefined, pathname: string): boolean {
  if (isAdmin(profile)) return true;
  return !ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p));
}
