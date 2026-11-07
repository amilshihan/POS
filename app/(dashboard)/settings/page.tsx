import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: paymentTypes }] = await Promise.all([
    supabase.from("shop_settings").select("*").single(),
    supabase.from("payment_types").select("*").order("sort_order"),
  ]);

  return <SettingsClient settings={settings} initialPaymentTypes={paymentTypes ?? []} />;
}
