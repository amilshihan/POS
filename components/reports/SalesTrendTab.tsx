"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";
import { LineChart } from "./Charts";
import { bucketSeries, daysAgoStr, todayStr, type Granularity } from "./reportUtils";
import Pagination, { paginate } from "@/components/ui/Pagination";

type SaleRow = { total: number; created_at: string };

export default function SalesTrendTab() {
  const supabase = createClient();
  const currency = useCurrencySymbol();

  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const toExclusive = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();
    supabase
      .from("sales")
      .select("total, created_at")
      .eq("status", "completed")
      .gte("created_at", from)
      .lt("created_at", toExclusive)
      .then(({ data }) => {
        if (!cancelled) {
          setSales((data ?? []) as SaleRow[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, supabase]);

  const revenueSeries = useMemo(
    () => bucketSeries(sales.map((s) => ({ date: s.created_at, value: Number(s.total) })), granularity),
    [sales, granularity]
  );
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const saleCount = sales.length;

  const [tablePage, setTablePage] = useState(1);
  const reversedRevenueSeries = useMemo(() => revenueSeries.slice().reverse(), [revenueSeries]);
  const { totalPages: tableTotalPages, currentPage: tableCurrentPage, paginated: paginatedRevenueSeries } = paginate(
    reversedRevenueSeries,
    tablePage
  );

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
        <div className="flex gap-2 ml-auto">
          {[
            { label: "7D", days: 6 },
            { label: "30D", days: 29 },
            { label: "90D", days: 89 },
            { label: "1Y", days: 364 },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setFrom(daysAgoStr(p.days));
                setTo(todayStr());
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Revenue ({from} to {to})</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currency}
            {totalRevenue.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Completed Sales</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{saleCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-2">Revenue Trend</div>
        {loading ? (
          <div className="text-sm text-slate-400 text-center py-8">Loading…</div>
        ) : (
          <LineChart data={revenueSeries} valueLabel={(v) => `${currency}${v.toFixed(0)}`} />
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Period</th>
              <th className="text-right px-4 py-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRevenueSeries.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              paginatedRevenueSeries.map((r) => (
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
        <Pagination
          page={tableCurrentPage}
          totalPages={tableTotalPages}
          totalItems={reversedRevenueSeries.length}
          shownCount={paginatedRevenueSeries.length}
          onPageChange={setTablePage}
          itemLabel="periods"
        />
      </div>
    </div>
  );
}
