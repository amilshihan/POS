import { createClient } from "@/lib/supabase/server";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [salesRes, itemsRes, customersRes] = await Promise.all([
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

  const outstandingCredit = customersRes.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports (last 30 days)</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Revenue</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Cost of Goods Sold</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">${totalCost.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Gross Profit</div>
          <div className="text-2xl font-bold text-green-700 mt-1">${grossProfit.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Sales by Staff
          </div>
          <ul className="divide-y divide-slate-100">
            {[...byStaff.entries()].map(([name, total]) => (
              <li key={name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">{name}</span>
                <span className="font-medium">${total.toFixed(2)}</span>
              </li>
            ))}
            {byStaff.size === 0 && <li className="px-5 py-4 text-sm text-slate-400">No sales yet.</li>}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Top Selling Parts
          </div>
          <ul className="divide-y divide-slate-100">
            {topParts.map(([name, d]) => (
              <li key={name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">
                  {name} <span className="text-slate-400">x{d.qty}</span>
                </span>
                <span className="font-medium">${d.revenue.toFixed(2)}</span>
              </li>
            ))}
            {topParts.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">No sales yet.</li>}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Outstanding Customer Credit
          </div>
          <ul className="divide-y divide-slate-100">
            {outstandingCredit.map((c) => (
              <li key={c.name} className="px-5 py-3 flex justify-between text-sm">
                <span className="text-slate-800">{c.name}</span>
                <span className="font-medium text-red-600">${c.credit_balance.toFixed(2)}</span>
              </li>
            ))}
            {outstandingCredit.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-400">No outstanding balances.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
