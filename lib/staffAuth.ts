// Supabase Auth is email-based under the hood. Staff created with just a
// username (see components/users/UsersClient.tsx) get a synthetic email in
// this fixed domain — it's never sent anywhere, just used so
// signInWithPassword always has something that looks like an email.
// Accounts with a real email (e.g. the original admin account, or anyone
// who later adds one from My Profile) log in with that instead; the login
// page tells the two apart by whether the typed identifier contains "@".
export const STAFF_EMAIL_DOMAIN = "staff.pos.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_EMAIL_DOMAIN}`;
}

export function isSyntheticStaffEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}
