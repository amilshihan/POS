"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };

type Part = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  category_id: string | null;
  cost_price?: number;
  sell_price: number;
  qty_on_hand: number;
  low_stock_threshold: number;
  unit: string;
};

const emptyForm = {
  id: "",
  sku: "",
  barcode: "",
  name: "",
  category_id: "",
  cost_price: "0",
  sell_price: "0",
  qty_on_hand: "0",
  low_stock_threshold: "5",
  unit: "pcs",
};

export default function InventoryClient({
  initialParts,
  categories,
  admin,
}: {
  initialParts: Part[];
  categories: Category[];
  admin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = initialParts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: Part) {
    setForm({
      id: p.id,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      name: p.name,
      category_id: p.category_id ?? "",
      cost_price: String(p.cost_price ?? 0),
      sell_price: String(p.sell_price),
      qty_on_hand: String(p.qty_on_hand),
      low_stock_threshold: String(p.low_stock_threshold),
      unit: p.unit,
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("Part name is required.");
      return;
    }
    setSaving(true);

    const payload = {
      sku: form.sku || null,
      barcode: form.barcode || null,
      name: form.name,
      category_id: form.category_id || null,
      cost_price: Number(form.cost_price),
      sell_price: Number(form.sell_price),
      qty_on_hand: Number(form.qty_on_hand),
      low_stock_threshold: Number(form.low_stock_threshold),
      unit: form.unit,
    };

    const { error } = form.id
      ? await supabase.from("parts").update(payload).eq("id", form.id)
      : await supabase.from("parts").insert(payload);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        {admin && (
          <button
            onClick={openNew}
            className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
          >
            + Add Part
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or SKU..."
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2"
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">SKU / Barcode</th>
              {admin && <th className="text-right px-4 py-2 font-medium">Cost</th>}
              <th className="text-right px-4 py-2 font-medium">Sell Price</th>
              <th className="text-right px-4 py-2 font-medium">Stock</th>
              {admin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className={p.qty_on_hand <= p.low_stock_threshold ? "bg-red-50" : ""}>
                <td className="px-4 py-2 text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                  {p.sku} {p.barcode && `/ ${p.barcode}`}
                </td>
                {admin && (
                  <td className="px-4 py-2 text-right text-slate-600">
                    ${Number(p.cost_price ?? 0).toFixed(2)}
                  </td>
                )}
                <td className="px-4 py-2 text-right text-slate-800">${p.sell_price.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {p.qty_on_hand} {p.unit}
                </td>
                {admin && (
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No parts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">
              {form.id ? "Edit Part" : "Add Part"}
            </h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Cost price</label>
                <input
                  type="number"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Sell price</label>
                <input
                  type="number"
                  value={form.sell_price}
                  onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500">Qty on hand</label>
                <input
                  type="number"
                  value={form.qty_on_hand}
                  onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Low stock at</label>
                <input
                  type="number"
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
