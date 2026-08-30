import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import POSClient from "@/components/pos/POSClient";

export default async function POSPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();

  const [partsRes, customersRes] = await Promise.all([
    supabase
      .from("parts_cashier")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase.from("customers").select("id, name, phone, credit_balance").order("name"),
  ]);

  return (
    <POSClient
      initialParts={partsRes.data ?? []}
      customers={customersRes.data ?? []}
      cashierId={profile?.id ?? ""}
    />
  );
}
