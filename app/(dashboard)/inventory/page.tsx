import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [partsRes, categoriesRes, suppliersRes, taxesRes] = await Promise.all([
    supabase.from(admin ? "parts" : "parts_cashier").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("taxes").select("*").order("name"),
  ]);

  return (
    <InventoryClient
      initialParts={partsRes.data ?? []}
      categories={categoriesRes.data ?? []}
      suppliers={suppliersRes.data ?? []}
      taxes={taxesRes.data ?? []}
      admin={admin}
    />
  );
}
