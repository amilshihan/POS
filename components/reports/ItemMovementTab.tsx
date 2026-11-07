"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LineChart, BarChart } from "./Charts";
import { bucketSeries, daysAgoStr, todayStr, type Granularity } from "./reportUtils";

type Part = { id: string; name: string; sku: string | null; qty_on_hand: number };
type Movement = { id: string; change_qty: number; reason: string; created_at: string };
type SaleMovement = { part_id: string; change_qty: number };

const REASON_LABEL: Record<string, string> = { sale: "Sale", purchase: "Purchase", adjustment: "Adjustment" };

export default function ItemMovementTab({ parts }: { parts: Part[] }) {
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [allMovements, setAllMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [topMovers, setTopMovers] = useState<{ part: Part; qtySold: number }[]>([]);
  const [topMoversLoading, setTopMoversLoading] = useState(true);
  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, parts]);

  useEffect(() => {
    if (!selectedPart) {
      setAllMovements([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("stock_movements")
      .select("id, change_qty, reason, created_at")
      .eq("part_id", selectedPart.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setAllMovements((data ?? []) as Movement[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPart, supabase]);

  useEffect(() => {
    if (selectedPart) return;
    let cancelled = false;
    setTopMoversLoading(true);
    const toExclusive = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();
    supabase
      .from("stock_movements")
      .select("part_id, change_qty")
      .eq("reason", "sale")
      .gte("created_at", from)
      .lt("created_at", toExclusive)
      .then(({ data }) => {
        if (cancelled) return;
        const qtyByPart = new Map<string, number>();
        for (const m of (data ?? []) as SaleMovement[]) {
          qtyByPart.set(m.part_id, (qtyByPart.get(m.part_id) ?? 0) - Number(m.change_qty));
        }
        const ranked = [...qtyByPart.entries()]
          .map(([partId, qtySold]) => ({ part: partById.get(partId), qtySold }))
          .filter((r): r is { part: Part; qtySold: number } => !!r.part)
          .sort((a, b) => b.qtySold - a.qtySold)
          .slice(0, 5);
        setTopMovers(ranked);
        setTopMoversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPart, from, to, supabase, partById]);

  const withRunningBalance = useMemo(() => {
    let running = 0;
    return allMovements.map((m) => {
      running += Number(m.change_qty);
      return { ...m, balance: running };
    });
  }, [allMovements]);

  const inRange = withRunningBalance.filter((m) => {
    const d = m.created_at.slice(0, 10);
    return d >= from && d <= to;
  });

  const balanceSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of inRange) {
      map.set(m.created_at.slice(0, 10), m.balance);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, value]) => ({ label: date, value }));
  }, [inRange]);

  const movementSeries = useMemo(
    () => bucketSeries(inRange.map((m) => ({ date: m.created_at, value: Number(m.change_qty) })), granularity),
    [inRange, granularity]
  );

  const soldQty = inRange.filter((m) => m.reason === "sale").reduce((s, m) => s - Number(m.change_qty), 0);
  const purchasedQty = inRange.filter((m) => m.reason === "purchase").reduce((s, m) => s + Number(m.change_qty), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="relative max-w-md flex-1">
            <label className="text-xs text-slate-500 block mb-1">Product</label>
            <input
              value={selectedPart ? `${selectedPart.name}${selectedPart.sku ? ` (${selectedPart.sku})` : ""}` : search}
              onChange={(e) => {
                setSelectedPart(null);
                setSearch(e.target.value);
              }}
              placeholder="Search product by name or SKU…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {!selectedPart && filteredParts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {filteredParts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPart(p);
                      setSearch("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                  >
                    {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPart && (
            <button
              onClick={() => {
                setSelectedPart(null);
                setSearch("");
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <label className="text-xs text-slate-500 block mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          {selectedPart && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Movement grouped by</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {!selectedPart ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-700 mb-1">
            Top 5 Fast Moving Items ({from} to {to})
          </div>
          <p className="text-xs text-slate-400 mb-3">Ranked by units sold. Click one to see its full movement history.</p>
          {topMoversLoading ? (
            <div className="text-sm text-slate-400 text-center py-8">Loading…</div>
          ) : topMovers.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">No sales in this range.</div>
          ) : (
            <>
              <BarChart data={topMovers.map((m) => ({ label: m.part.name, value: m.qtySold }))} valueLabel={(v) => v.toFixed(0)} />
              <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {topMovers.map((m, i) => (
                  <button
                    key={m.part.id}
                    onClick={() => {
                      setSelectedPart(m.part);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-1 py-2 text-sm hover:bg-slate-50 text-left"
                  >
                    <span className="text-slate-700">
                      <span className="text-slate-400 mr-2">#{i + 1}</span>
                      {m.part.name}
                      {m.part.sku && <span className="text-slate-400"> ({m.part.sku})</span>}
                    </span>
                    <span className="font-medium text-slate-900">{m.qtySold.toFixed(0)} sold</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500">Current Stock</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{selectedPart.qty_on_hand}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500">Sold ({from} to {to})</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{soldQty.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500">Purchased ({from} to {to})</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{purchasedQty.toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-semibold text-slate-700 mb-2">Stock Level Over Time</div>
            <LineChart data={balanceSeries} valueLabel={(v) => v.toFixed(0)} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm font-semibold text-slate-700 mb-2">Net Movement ({granularity})</div>
            <BarChart data={movementSeries} valueLabel={(v) => v.toFixed(0)} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Reason</th>
                  <th className="text-right px-4 py-2 font-medium">Change</th>
                  <th className="text-right px-4 py-2 font-medium">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inRange.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No movements in this range.
                    </td>
                  </tr>
                ) : (
                  inRange
                    .slice()
                    .reverse()
                    .map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 text-slate-700">{new Date(m.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-slate-600">{REASON_LABEL[m.reason] ?? m.reason}</td>
                        <td className={`px-4 py-2 text-right font-medium ${Number(m.change_qty) >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {Number(m.change_qty) >= 0 ? "+" : ""}
                          {Number(m.change_qty).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-800">{m.balance.toFixed(2)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
