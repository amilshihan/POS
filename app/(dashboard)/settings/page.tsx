import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: paymentTypes }, { data: menuPermissions }, { data: roles }] =
    await Promise.all([
      supabase.from("shop_settings").select("*").single(),
      supabase.from("payment_types").select("*").order("sort_order"),
      supabase.from("menu_permissions").select("role, path, enabled"),
      supabase.from("roles").select("name, label, is_system").order("is_system", { ascending: false }),
    ]);

  return (
    <SettingsClient
      settings={settings}
      initialPaymentTypes={paymentTypes ?? []}
      initialMenuPermissions={menuPermissions ?? []}
      initialRoles={roles ?? []}
    />
  );
}
