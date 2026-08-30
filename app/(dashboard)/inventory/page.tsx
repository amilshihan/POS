import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [partsRes, categoriesRes] = await Promise.all([
    supabase.from(admin ? "parts" : "parts_cashier").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <InventoryClient
      initialParts={partsRes.data ?? []}
      categories={categoriesRes.data ?? []}
      admin={admin}
    />
  );
}
