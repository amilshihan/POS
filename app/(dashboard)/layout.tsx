import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import CurrencyProvider from "@/components/providers/CurrencyProvider";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    redirect("/login");
  }

  const admin = isAdmin(profile);

  const supabase = await createClient();
  const { data: settings } = await supabase.from("shop_settings").select("currency").single();

  return (
    <CurrencyProvider currency={settings?.currency}>
      <DashboardShell admin={admin} displayName={`${profile?.full_name ?? user.email} · ${admin ? "Admin" : "Cashier"}`}>
        {children}
      </DashboardShell>
    </CurrencyProvider>
  );
}
