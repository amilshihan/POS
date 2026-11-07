import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import POSClient from "@/components/pos/POSClient";

export default async function POSPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [partsRes, customersRes, drumPricesRes, draftsRes, packagesRes] = await Promise.all([
    admin
      ? supabase
          .from("parts")
          .select(
            "id, sku, barcode, name, cost_price, sell_price, qty_on_hand, unit, is_drum, pack_size, drum_measurement, open_qty_remaining"
          )
          .eq("is_active", true)
          .order("name")
      : supabase
          .from("parts_cashier")
          .select("*")
          .eq("is_active", true)
          .order("name"),
    supabase
      .from("customers")
      .select("id, customer_code, name, phone, credit_balance, credit_limit")
      .eq("is_active", true)
      .order("name"),
    supabase.from("drum_retail_prices").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("sale_drafts")
      .select("*, customers(name), profiles!sale_drafts_created_by_fkey(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("packages")
      .select("id, name, description, price, package_items(id, qty, part_id)")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <POSClient
      initialParts={partsRes.data ?? []}
      customers={customersRes.data ?? []}
      cashierId={profile?.id ?? ""}
      admin={admin}
      drumRetailPrices={drumPricesRes.data ?? []}
      initialDrafts={draftsRes.data ?? []}
      packages={packagesRes.data ?? []}
    />
  );
}
