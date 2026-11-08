import { createClient } from "@/lib/supabase/server";
import PromoClient from "@/components/promo/PromoClient";

export default async function PromoPage() {
  const supabase = await createClient();

  const [partsRes, settingsRes] = await Promise.all([
    supabase
      .from("parts")
      .select("id, name, sku, sell_price, retail_price, image_url")
      .eq("is_active", true)
      .eq("is_service", false)
      .order("name"),
    supabase.from("shop_settings").select("shop_name, phone, email, logo_url").single(),
  ]);

  return (
    <PromoClient
      parts={partsRes.data ?? []}
      settings={
        settingsRes.data ?? { shop_name: "Spare Parts Shop", phone: null, email: null, logo_url: null }
      }
    />
  );
}
