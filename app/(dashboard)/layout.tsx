import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CurrencyProvider from "@/components/providers/CurrencyProvider";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    redirect("/login");
  }

  const role = profile?.role ?? "cashier";

  const supabase = await createClient();
  const [{ data: settings }, { data: permissions }, { data: roles }] = await Promise.all([
    supabase.from("shop_settings").select("currency").single(),
    supabase.from("menu_permissions").select("role, path, enabled"),
    supabase.from("roles").select("name, label"),
  ]);
  const roleLabel = roles?.find((r) => r.name === role)?.label ?? role;

  return (
    <CurrencyProvider currency={settings?.currency}>
      <DashboardShell
        role={role}
        permissions={permissions ?? []}
        displayName={`${profile?.full_name ?? user.email} · ${roleLabel}`}
      >
        {children}
      </DashboardShell>
    </CurrencyProvider>
  );
}
