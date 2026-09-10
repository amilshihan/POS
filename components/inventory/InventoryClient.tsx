"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; parent_id: string | null };
type Supplier = { id: string; name: string };
type Tax = { id: string; name: string; rate_percent: number; is_default: boolean };

type GroupOption = { id: string; path: string };

function buildGroupPaths(categories: Category[]): GroupOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  function pathFor(id: string, seen: Set<string> = new Set()): string {
    if (seen.has(id)) return "?";
    seen.add(id);
    const c = byId.get(id);
    if (!c) return "?";
    return c.parent_id ? `${pathFor(c.parent_id, seen)}/${c.name}` : c.name;
  }
  return categories.map((c) => ({ id: c.id, path: pathFor(c.id) })).sort((a, b) => a.path.localeCompare(b.path));
}

function GroupPicker({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "No group",
}: {
  options: GroupOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = query ? options.filter((o) => o.path.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div className="relative">
      <input
        value={open ? query : (selected?.path ?? "")}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
          {onCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCreate}
              className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-slate-100"
            >
              + New group…
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-sm ${
              !value ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            No group
            {!value && <span>✓</span>}
          </button>
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-sm ${
                value === o.id ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              {o.path}
              {value === o.id && <span>✓</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No matching groups</div>}
        </div>
      )}
    </div>
  );
}

type Part = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  cost_price?: number;
  sell_price: number;
  retail_price: number;
  markup_percent: number | null;
  tax_id: string | null;
  is_tax_inclusive_price: boolean;
  is_price_change_allowed: boolean;
  is_using_default_quantity: boolean;
  is_service: boolean;
  supplier_id?: string | null;
  qty_on_hand: number;
  reorder_point?: number | null;
  preferred_quantity?: number | null;
  low_stock_threshold: number;
  low_stock_warning_enabled: boolean;
  unit: string;
  is_active: boolean;
};

const emptyForm = {
  id: "",
  sku: "",
  barcode: "",
  name: "",
  description: "",
  category_id: "",
  unit: "pcs",
  cost_price: "0",
  retail_price: "0",
  markup_percent: "",
  sell_price: "0",
  tax_id: "",
  is_tax_inclusive_price: false,
  is_price_change_allowed: true,
  is_using_default_quantity: true,
  is_service: false,
  is_active: true,
  qty_on_hand: "0",
  supplier_id: "",
  reorder_point: "",
  preferred_quantity: "",
  low_stock_warning_enabled: true,
  low_stock_threshold: "5",
};

export default function InventoryClient({
  initialParts,
  categories,
  suppliers,
  taxes,
  admin,
}: {
  initialParts: Part[];
  categories: Category[];
  suppliers: Supplier[];
  taxes: Tax[];
  admin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const groupOptions = useMemo(() => buildGroupPaths(categories), [categories]);
  const [promptDialog, setPromptDialog] = useState<{
    title: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  function askText(title: string, defaultValue: string, onSubmit: (value: string) => void) {
    setPromptValue(defaultValue);
    setPromptDialog({ title, onSubmit });
  }

  function askConfirm(message: string, onConfirm: () => void) {
    setConfirmDialog({ message, onConfirm });
  }

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
      description: p.description ?? "",
      category_id: p.category_id ?? "",
      unit: p.unit,
      cost_price: String(p.cost_price ?? 0),
      retail_price: String(p.retail_price ?? 0),
      markup_percent: p.markup_percent === null ? "" : String(p.markup_percent),
      sell_price: String(p.sell_price),
      tax_id: p.tax_id ?? "",
      is_tax_inclusive_price: p.is_tax_inclusive_price,
      is_price_change_allowed: p.is_price_change_allowed,
      is_using_default_quantity: p.is_using_default_quantity,
      is_service: p.is_service,
      is_active: p.is_active,
      qty_on_hand: String(p.qty_on_hand),
      supplier_id: p.supplier_id ?? "",
      reorder_point: p.reorder_point === null || p.reorder_point === undefined ? "" : String(p.reorder_point),
      preferred_quantity:
        p.preferred_quantity === null || p.preferred_quantity === undefined ? "" : String(p.preferred_quantity),
      low_stock_warning_enabled: p.low_stock_warning_enabled,
      low_stock_threshold: String(p.low_stock_threshold),
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    setSaving(true);

    const payload = {
      sku: form.sku || null,
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      unit: form.unit,
      cost_price: Number(form.cost_price),
      retail_price: Number(form.retail_price),
      markup_percent: form.markup_percent === "" ? null : Number(form.markup_percent),
      sell_price: Number(form.sell_price),
      tax_id: form.tax_id || null,
      is_tax_inclusive_price: form.is_tax_inclusive_price,
      is_price_change_allowed: form.is_price_change_allowed,
      is_using_default_quantity: form.is_using_default_quantity,
      is_service: form.is_service,
      is_active: form.is_active,
      qty_on_hand: Number(form.qty_on_hand),
      supplier_id: form.supplier_id || null,
      reorder_point: form.reorder_point === "" ? null : Number(form.reorder_point),
      preferred_quantity: form.preferred_quantity === "" ? null : Number(form.preferred_quantity),
      low_stock_warning_enabled: form.low_stock_warning_enabled,
      low_stock_threshold: Number(form.low_stock_threshold),
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

  async function createGroupPath(fullPath: string): Promise<string | null> {
    const segments = fullPath
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) return null;

    const working = [...categories];
    let parentId: string | null = null;
    let leafId: string | null = null;

    for (const segment of segments) {
      const existing = working.find((c) => c.name === segment && (c.parent_id ?? null) === parentId);
      if (existing) {
        parentId = existing.id;
        leafId = existing.id;
        continue;
      }
      const { data, error }: { data: Category | null; error: { message: string } | null } = await supabase
        .from("categories")
        .insert({ name: segment, parent_id: parentId })
        .select()
        .single();
      if (error || !data) {
        setGroupError(error?.message ?? "Could not create group.");
        return null;
      }
      working.push(data);
      parentId = data.id;
      leafId = data.id;
    }
    return leafId;
  }

  function handleNewGroup(onCreated?: (id: string) => void) {
    askText('New group (use "/" to nest, e.g. "Products/Oil/Castrol")', "", async (path) => {
      if (!path.trim()) return;
      setGroupError(null);
      const leafId = await createGroupPath(path);
      if (leafId) {
        onCreated ? onCreated(leafId) : setGroupId(leafId);
        router.refresh();
      }
    });
  }

  function handleEditGroup() {
    if (!groupId) {
      setGroupError("Select a product group to edit first.");
      return;
    }
    const current = categories.find((c) => c.id === groupId);
    const currentPath = groupOptions.find((o) => o.id === groupId)?.path;
    askText(`Rename group "${currentPath ?? ""}" to:`, current?.name ?? "", async (name) => {
      if (!name.trim()) return;
      setGroupError(null);
      const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", groupId);
      if (error) {
        setGroupError(error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteGroup() {
    if (!groupId) {
      setGroupError("Select a product group to delete first.");
      return;
    }
    const currentPath = groupOptions.find((o) => o.id === groupId)?.path;
    askConfirm(
      `Delete group "${currentPath}"? Its products and any subgroups will become ungrouped/top-level.`,
      async () => {
        setGroupError(null);
        const { error } = await supabase.from("categories").delete().eq("id", groupId);
        if (error) {
          setGroupError(error.message);
          return;
        }
        setGroupId("");
        router.refresh();
      }
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        {admin && (
          <button
            onClick={openNew}
            className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
          >
            + Add Product
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or SKU..."
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2"
      />

      {admin && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 shrink-0">Product Groups</label>
          <div className="w-64">
            <GroupPicker
              options={groupOptions}
              value={groupId}
              onChange={(id) => {
                setGroupId(id);
                setGroupError(null);
              }}
              placeholder="Select a group…"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="New group"
              onClick={() => handleNewGroup()}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path
                  d="M3 5.5A1.5 1.5 0 0 1 4.5 4H8l1.5 1.75H15.5A1.5 1.5 0 0 1 17 7.25v7.25A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z"
                  strokeLinejoin="round"
                />
                <path d="M10 9v4M8 11h4" strokeLinecap="round" />
              </svg>
              New group
            </button>
            <button
              type="button"
              title="Edit group"
              onClick={handleEditGroup}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M13.5 3.5a1.5 1.5 0 0 1 2 2L7 14 4 15l1-3 8.5-8.5Z" strokeLinejoin="round" />
              </svg>
              Edit group
            </button>
            <button
              type="button"
              title="Delete group"
              onClick={handleDeleteGroup}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path
                  d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete group
            </button>
          </div>
          {groupError && <span className="text-xs text-red-600">{groupError}</span>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">SKU / Barcode</th>
              {admin && <th className="text-right px-4 py-2 font-medium">Cost</th>}
              <th className="text-right px-4 py-2 font-medium">Price</th>
              <th className="text-right px-4 py-2 font-medium">Stock</th>
              {admin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr
                key={p.id}
                className={
                  !p.is_service && p.low_stock_warning_enabled && p.qty_on_hand <= p.low_stock_threshold
                    ? "bg-red-50"
                    : ""
                }
              >
                <td className="px-4 py-2 text-slate-800">
                  {p.name}
                  {p.is_service && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1.5 py-0.5">
                      Service
                    </span>
                  )}
                  {!p.is_active && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                      Disabled
                    </span>
                  )}
                </td>
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
                  {p.is_service ? "—" : `${p.qty_on_hand} ${p.unit}`}
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
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-20 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-4 my-8 mt-12">
            <h2 className="font-semibold text-lg text-slate-900">
              {form.id ? "Edit Product" : "Add Product"}
            </h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

            {/* Basic info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Product Group</label>
                  <GroupPicker
                    options={groupOptions}
                    value={form.category_id}
                    onChange={(id) => setForm({ ...form, category_id: id })}
                    onCreate={() => handleNewGroup((id) => setForm((f) => ({ ...f, category_id: id })))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Measurement Unit</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">SKU</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Barcode</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Cost</label>
                  <input
                    type="number"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Retail Price</label>
                  <input
                    type="number"
                    value={form.retail_price}
                    onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Markup %</label>
                  <input
                    type="number"
                    value={form.markup_percent}
                    onChange={(e) => setForm({ ...form, markup_percent: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Price (POS sell price)</label>
                  <input
                    type="number"
                    value={form.sell_price}
                    onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Tax</label>
                <select
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">No tax</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate_percent}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_tax_inclusive_price}
                    onChange={(e) => setForm({ ...form, is_tax_inclusive_price: e.target.checked })}
                  />
                  Price is tax-inclusive
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_price_change_allowed}
                    onChange={(e) => setForm({ ...form, is_price_change_allowed: e.target.checked })}
                  />
                  Allow price change at POS
                </label>
              </div>
            </div>

            {/* Behavior */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Behavior</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_using_default_quantity}
                    onChange={(e) => setForm({ ...form, is_using_default_quantity: e.target.checked })}
                  />
                  Use default quantity (1) at POS
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_service}
                    onChange={(e) => setForm({ ...form, is_service: e.target.checked })}
                  />
                  This is a service (not stock-tracked)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
            </div>

            {/* Stock */}
            {!form.is_service && (
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Quantity</label>
                    <input
                      type="number"
                      value={form.qty_on_hand}
                      onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Supplier</label>
                    <select
                      value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">No preferred supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Reorder Point</label>
                    <input
                      type="number"
                      value={form.reorder_point}
                      onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Preferred Quantity</label>
                    <input
                      type="number"
                      value={form.preferred_quantity}
                      onChange={(e) => setForm({ ...form, preferred_quantity: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.low_stock_warning_enabled}
                      onChange={(e) => setForm({ ...form, low_stock_warning_enabled: e.target.checked })}
                    />
                    Warn on low stock
                  </label>
                  {form.low_stock_warning_enabled && (
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Warning Quantity</label>
                      <input
                        type="number"
                        value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
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

      {promptDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-slate-900">{promptDialog.title}</h3>
            <input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  promptDialog.onSubmit(promptValue);
                  setPromptDialog(null);
                } else if (e.key === "Escape") {
                  setPromptDialog(null);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromptDialog(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  promptDialog.onSubmit(promptValue);
                  setPromptDialog(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4">
            <p className="text-sm text-slate-700">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
