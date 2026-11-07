import { createClient } from "@/lib/supabase/server";
import ReportsClient from "@/components/reports/ReportsClient";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [salesRes, itemsRes, customersRes, partsRes, categoriesRes, suppliersRes] = await Promise.all([
    supabase
      .from("sales")
      .select("total, created_at, profiles!sales_cashier_id_fkey(full_name)")
      .eq("status", "completed")
      .gte("created_at", daysAgo(30)),
    supabase
      .from("sale_items")
      .select("qty, line_total, cost_price_snapshot, parts(name), sales!inner(created_at, status)")
      .eq("sales.status", "completed")
      .gte("sales.created_at", daysAgo(30)),
    supabase.from("customers").select("name, credit_balance").gt("credit_balance", 0).order("credit_balance", { ascending: false }),
    supabase.from("parts").select("id, name, sku, qty_on_hand").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, name, parent_id"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const sales = salesRes.data ?? [];
  const items = (itemsRes.data ?? []) as unknown as {
    qty: number;
    line_total: number;
    cost_price_snapshot: number;
    parts: { name: string };
  }[];

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalCost = items.reduce((sum, i) => sum + Number(i.cost_price_snapshot) * Number(i.qty), 0);
  const grossProfit = totalRevenue - totalCost;

  const byStaff = new Map<string, number>();
  for (const s of sales) {
    const name = (s as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ?? "Unknown";
    byStaff.set(name, (byStaff.get(name) ?? 0) + Number(s.total));
  }

  const byPart = new Map<string, { qty: number; revenue: number }>();
  for (const i of items) {
    const name = i.parts?.name ?? "Unknown";
    const prev = byPart.get(name) ?? { qty: 0, revenue: 0 };
    byPart.set(name, { qty: prev.qty + Number(i.qty), revenue: prev.revenue + Number(i.line_total) });
  }
  const topParts = [...byPart.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);

  return (
    <ReportsClient
      overview={{
        totalRevenue,
        totalCost,
        grossProfit,
        byStaff: [...byStaff.entries()],
        topParts,
        outstandingCredit: customersRes.data ?? [],
      }}
      parts={partsRes.data ?? []}
      categories={categoriesRes.data ?? []}
      suppliers={suppliersRes.data ?? []}
    />
  );
}
