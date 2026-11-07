"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";

type Part = { id: string; name: string; sku: string | null; cost_price: number; sell_price: number };

type PackageItem = { id: string; qty: number; parts: Part };

type Package = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  package_items: PackageItem[];
};

type FormItem = { key: string; part: Part; qty: number };

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

export default function PackagesClient({
  initialPackages,
  parts,
  admin,
  createdBy,
}: {
  initialPackages: Package[];
  parts: Part[];
  admin: boolean;
  createdBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrencySymbol();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const normalTotal = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.part.sell_price, 0), [items]);
  const costFloor = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.part.cost_price * 1.03, 0), [items]);
  const totalQty = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const suggestedPrice = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.part.cost_price * 1.1, 0), [items]);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, parts]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setItems([]);
    setSearch("");
    setError(null);
    setShowForm(true);
  }

  function openEdit(pkg: Package) {
    setEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description ?? "");
    setPrice(String(pkg.price));
    setItems(pkg.package_items.map((pi) => ({ key: newKey(), part: pi.parts, qty: Number(pi.qty) })));
    setSearch("");
    setError(null);
    setShowForm(true);
  }

  function addItem(part: Part) {
    setItems((prev) => {
      const existing = prev.find((i) => i.part.id === part.id);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { key: newKey(), part, qty: 1 }];
    });
    setSearch("");
  }

  function updateQty(key: string, qty: number) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(0, qty) } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a package name.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one product.");
      return;
    }
    if (totalQty < 2) {
      setError("A package needs at least two units total (e.g. 2 of one product, or 1 each of two products).");
      return;
    }
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a package price.");
      return;
    }

    setSaving(true);
    try {
      let packageId = editingId;
      if (editingId) {
        const { error: updateError } = await supabase
          .from("packages")
          .update({ name: name.trim(), description: description.trim() || null, price: priceNum })
          .eq("id", editingId);
        if (updateError) throw updateError;
        const { error: deleteItemsError } = await supabase.from("package_items").delete().eq("package_id", editingId);
        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data: newPackage, error: insertError } = await supabase
          .from("packages")
          .insert({ name: name.trim(), description: description.trim() || null, price: priceNum, created_by: createdBy })
          .select()
          .single();
        if (insertError || !newPackage) throw insertError ?? new Error("Could not create package");
        packageId = newPackage.id;
      }

      const { error: itemsError } = await supabase.from("package_items").insert(
        items.map((i) => ({ package_id: packageId, part_id: i.part.id, qty: i.qty }))
      );
      if (itemsError) throw itemsError;

      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save package.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(pkg: Package) {
    await supabase.from("packages").update({ is_active: !pkg.is_active }).eq("id", pkg.id);
    router.refresh();
  }

  async function handleDelete(pkg: Package) {
    if (!window.confirm(`Delete package "${pkg.name}"? This cannot be undone.`)) return;
    setDeletingId(pkg.id);
    await supabase.from("packages").delete().eq("id", pkg.id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Packages</h1>
        {admin && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-700"
          >
            + New Package
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Items</th>
              <th className="text-right px-4 py-2 font-medium">Price</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              {admin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialPackages.length === 0 ? (
              <tr>
                <td colSpan={admin ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  No packages yet.
                </td>
              </tr>
            ) : (
              initialPackages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="px-4 py-2 text-slate-800 font-medium">
                    {pkg.name}
                    {pkg.description && <div className="text-xs text-slate-400 font-normal">{pkg.description}</div>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {pkg.package_items.map((pi) => `${pi.qty}× ${pi.parts.name}`).join(", ")}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">
                    {currency}
                    {Number(pkg.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        pkg.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {admin && (
                    <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                      <button onClick={() => openEdit(pkg)} className="text-blue-600 hover:underline text-xs font-medium">
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        className="text-slate-500 hover:underline text-xs font-medium"
                      >
                        {pkg.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(pkg)}
                        disabled={deletingId === pkg.id}
                        className="text-red-500 hover:underline text-xs font-medium disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg text-slate-900">{editingId ? "Edit Package" : "New Package"}</h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

            <input
              placeholder="Package name (e.g. Motul 10W-30 3L x2 Combo)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={2}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Products in this package</label>
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product by name or SKU..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                {filteredParts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {filteredParts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addItem(p)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                      >
                        {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                        <span className="text-slate-400"> — {currency}{p.sell_price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {items.map((i) => (
                  <div key={i.key} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 text-sm text-slate-800">
                      {i.part.name}
                      <div className="text-xs text-slate-400">
                        {currency}
                        {i.part.sell_price.toFixed(2)} each
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={i.qty}
                      onChange={(e) => updateQty(i.key, Number(e.target.value))}
                      className="w-16 text-center rounded border border-slate-300 py-1"
                    />
                    <button onClick={() => removeItem(i.key)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="text-xs text-slate-500 space-y-1">
                <div>
                  Normal total: {currency}
                  {normalTotal.toFixed(2)} &middot; Minimum allowed package price: {currency}
                  {costFloor.toFixed(2)}
                </div>
                <div>
                  Cost + 10% profit price: {currency}
                  {suggestedPrice.toFixed(2)}{" "}
                  <button
                    type="button"
                    onClick={() => setPrice(suggestedPrice.toFixed(2))}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Use this price
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Package price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
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
                {saving ? "Saving..." : "Save Package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
