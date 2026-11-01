import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import NewPurchaseClient from "@/components/purchases/NewPurchaseClient";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();

  const [suppliersRes, partsRes] = await Promise.all([
    supabase.from("suppliers").select("id, name, phone, address").order("name"),
    supabase.from("parts").select("id, name, sku, cost_price, retail_price, supplier_id").order("name"),
  ]);

  return (
    <NewPurchaseClient
      suppliers={suppliersRes.data ?? []}
      parts={partsRes.data ?? []}
      purchasedBy={profile?.id ?? ""}
    />
  );
}
