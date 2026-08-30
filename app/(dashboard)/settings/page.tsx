import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("shop_settings").select("*").single();

  return <SettingsClient settings={settings} />;
}
