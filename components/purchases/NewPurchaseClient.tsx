"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Supplier = { id: string; name: string };
type Part = { id: string; name: string; sku: string | null; cost_price: number };
type Line = { part: Part; qty: number; unitCost: number };

export default function NewPurchaseClient({
  suppliers,
  parts,
  purchasedBy,
}: {
  suppliers: Supplier[];
  parts: Part[];
  purchasedBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0), [lines]);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, parts]);

  function addPart(part: Part) {
    setLines((prev) => {
      const existing = prev.find((l) => l.part.id === part.id);
      if (existing) return prev.map((l) => (l.part.id === part.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { part, qty: 1, unitCost: part.cost_price }];
    });
    setSearch("");
  }

  function updateLine(partId: string, field: "qty" | "unitCost", value: number) {
    setLines((prev) => prev.map((l) => (l.part.id === partId ? { ...l, [field]: value } : l)));
  }

  function removeLine(partId: string) {
    setLines((prev) => prev.filter((l) => l.part.id !== partId));
  }

  async function handleSave() {
    setError(null);
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one part.");
      return;
    }
    setSaving(true);
    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({ supplier_id: supplierId, purchased_by: purchasedBy, total, payment_status: "unpaid" })
        .select()
        .single();
      if (purchaseError || !purchase) throw purchaseError ?? new Error("Could not create purchase");

      const { error: itemsError } = await supabase.from("purchase_items").insert(
        lines.map((l) => ({
          purchase_id: purchase.id,
          part_id: l.part.id,
          qty: l.qty,
          unit_cost: l.unitCost,
          line_total: l.qty * l.unitCost,
        }))
      );
      if (itemsError) throw itemsError;

      router.push("/suppliers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">New Purchase</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">Supplier</label>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Select supplier...</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium text-slate-700 pt-2">Add parts</label>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part by name or SKU..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {filteredParts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {filteredParts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                >
                  {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Part</th>
              <th className="text-center px-4 py-2 font-medium">Qty</th>
              <th className="text-right px-4 py-2 font-medium">Unit Cost</th>
              <th className="text-right px-4 py-2 font-medium">Line Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No parts added yet.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.part.id}>
                  <td className="px-4 py-2 text-slate-800">{l.part.name}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateLine(l.part.id, "qty", Number(e.target.value))}
                      className="w-16 text-center rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={l.unitCost}
                      onChange={(e) => updateLine(l.part.id, "unitCost", Number(e.target.value))}
                      className="w-20 text-right rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    ${(l.qty * l.unitCost).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removeLine(l.part.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-lg font-bold text-slate-900">Total: ${total.toFixed(2)}</div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white font-semibold px-6 py-2.5 hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Purchase"}
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
    </div>
  );
}
