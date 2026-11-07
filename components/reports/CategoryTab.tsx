"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";
import { BarChart, LineChart } from "./Charts";
import { bucketSeries, daysAgoStr, todayStr, type Granularity } from "./reportUtils";

type Category = { id: string; name: string; parent_id: string | null };
type SaleItemRow = {
  qty: number;
  line_total: number;
  parts: { category_id: string | null } | null;
  sales: { created_at: string; status: string } | null;
};

function buildPaths(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathFor = (id: string): string => {
    const c = byId.get(id);
    if (!c) return "";
    return c.parent_id ? `${pathFor(c.parent_id)}/${c.name}` : c.name;
  };
  return new Map(categories.map((c) => [c.id, pathFor(c.id)]));
}

export default function CategoryTab({ categories }: { categories: Category[] }) {
  const supabase = createClient();
  const currency = useCurrencySymbol();

  const pathById = useMemo(() => buildPaths(categories), [categories]);
  const options = useMemo(
    () => categories.map((c) => ({ id: c.id, path: pathById.get(c.id) ?? c.name })).sort((a, b) => a.path.localeCompare(b.path)),
    [categories, pathById]
  );

  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [categoryId, setCategoryId] = useState<string>("");
  const [rows, setRows] = useState<SaleItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const toExclusive = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();
    supabase
      .from("sale_items")
      .select("qty, line_total, parts(category_id), sales!inner(created_at, status)")
      .eq("sales.status", "completed")
      .gte("sales.created_at", from)
      .lt("sales.created_at", toExclusive)
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data ?? []) as unknown as SaleItemRow[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, supabase]);

  const selectedPath = categoryId ? pathById.get(categoryId) : null;

  const rowsForSelection = useMemo(() => {
    if (!categoryId) return rows;
    return rows.filter((r) => {
      const cid = r.parts?.category_id;
      if (!cid) return false;
      if (cid === categoryId) return true;
      const path = pathById.get(cid) ?? "";
      return selectedPath ? path.startsWith(selectedPath + "/") : false;
    });
  }, [rows, categoryId, selectedPath, pathById]);

  const byCategoryBar = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const cid = r.parts?.category_id;
      const label = cid ? (pathById.get(cid) ?? "Unknown") : "Uncategorized";
      map.set(label, (map.get(label) ?? 0) + Number(r.line_total));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [rows, pathById]);

  const trendSeries = useMemo(
    () =>
      bucketSeries(
        rowsForSelection.map((r) => ({ date: r.sales?.created_at ?? "", value: Number(r.line_total) })),
        granularity
      ),
    [rowsForSelection, granularity]
  );

  const totalForSelection = rowsForSelection.reduce((s, r) => s + Number(r.line_total), 0);
  const qtyForSelection = rowsForSelection.reduce((s, r) => s + Number(r.qty), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div className="min-w-[200px]">
          <label className="text-xs text-slate-500 block mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">All categories</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.path}
              </option>
            ))}
          </select>
        </div>
        {categoryId && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Group by</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : !categoryId ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-700 mb-2">Revenue by Category ({from} to {to})</div>
          <BarChart data={byCategoryBar} valueLabel={(v) => `${currency}${v.toFixed(0)}`} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500">Revenue — {selectedPath}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {currency}
                {totalForSelection.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500">Units Sold</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{qtyForSelection.toFixed(2)}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-semibold text-slate-700 mb-2">Trend — {selectedPath}</div>
            <LineChart data={trendSeries} valueLabel={(v) => `${currency}${v.toFixed(0)}`} />
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">{categoryId ? "Period" : "Category"}</th>
              <th className="text-right px-4 py-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(categoryId ? trendSeries : byCategoryBar).length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              (categoryId ? trendSeries.slice().reverse() : byCategoryBar).map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2 text-slate-700">{r.label}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {currency}
                    {r.value.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
