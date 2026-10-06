import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import POSClient from "@/components/pos/POSClient";

export default async function POSPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [partsRes, customersRes] = await Promise.all([
    admin
      ? supabase
          .from("parts")
          .select("id, sku, barcode, name, cost_price, sell_price, qty_on_hand, unit")
          .eq("is_active", true)
          .order("name")
      : supabase
          .from("parts_cashier")
          .select("*")
          .eq("is_active", true)
          .order("name"),
    supabase
      .from("customers")
      .select("id, customer_code, name, phone, credit_balance")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <POSClient
      initialParts={partsRes.data ?? []}
      customers={customersRes.data ?? []}
      cashierId={profile?.id ?? ""}
      admin={admin}
    />
  );
}
