import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import PackagesClient from "@/components/packages/PackagesClient";

export default async function PackagesPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [packagesRes, partsRes] = await Promise.all([
    supabase
      .from("packages")
      .select("id, name, description, price, is_active, package_items(id, qty, parts(id, name, sku, cost_price, sell_price))")
      .order("name"),
    supabase.from("parts").select("id, name, sku, cost_price, sell_price").eq("is_active", true).order("name"),
  ]);

  return (
    <PackagesClient
      initialPackages={(packagesRes.data ?? []) as unknown as Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        is_active: boolean;
        package_items: {
          id: string;
          qty: number;
          parts: { id: string; name: string; sku: string | null; cost_price: number; sell_price: number };
        }[];
      }>}
      parts={partsRes.data ?? []}
      admin={admin}
      createdBy={profile?.id ?? ""}
    />
  );
}
