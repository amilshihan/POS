"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TITLES, combineTitleName, isValidName, isValidPhone } from "@/lib/validation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, combinePhone } from "@/lib/countries";

type Customer = { id: string; customer_code: string; name: string };
type Brand = { id: string; name: string };
type Model = { id: string; brand_id: string; name: string };
type Vehicle = {
  id: string;
  customer_id: string;
  vehicle_number: string;
  brand_id: string | null;
  model_id: string | null;
  year: number | null;
  engine_number: string | null;
  chassis_number: string | null;
  notes: string | null;
  customers: { customer_code: string; name: string } | null;
  vehicle_brands: { name: string } | null;
  vehicle_models: { name: string } | null;
};

const EMPTY_FORM = {
  id: "",
  customer_id: "",
  vehicle_number: "",
  brand_id: "",
  model_id: "",
  year: "",
  engine_number: "",
  chassis_number: "",
  notes: "",
};

export default function VehiclesClient({
  initialVehicles,
  customers,
  brands,
  models,
}: {
  initialVehicles: Vehicle[];
  customers: Customer[];
  brands: Brand[];
  models: Model[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [localBrands, setLocalBrands] = useState(brands);
  const [localModels, setLocalModels] = useState(models);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; failed: number; errors: string[] } | null>(
    null
  );

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [qcTitle, setQcTitle] = useState("");
  const [qcName, setQcName] = useState("");
  const [qcPhoneCountry, setQcPhoneCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [qcPhone, setQcPhone] = useState("");
  const [qcSaving, setQcSaving] = useState(false);

  const [showAddBrand, setShowAddBrand] = useState(false);
  const [qbName, setQbName] = useState("");
  const [qbSaving, setQbSaving] = useState(false);

  const [showAddModel, setShowAddModel] = useState(false);
  const [qmName, setQmName] = useState("");
  const [qmSaving, setQmSaving] = useState(false);

  const filtered = initialVehicles.filter((v) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      v.vehicle_number.toLowerCase().includes(q) ||
      v.customers?.name.toLowerCase().includes(q) ||
      v.customers?.customer_code.toLowerCase().includes(q) ||
      v.vehicle_brands?.name.toLowerCase().includes(q) ||
      v.vehicle_models?.name.toLowerCase().includes(q)
    );
  });

  const modelsForBrand = localModels.filter((m) => m.brand_id === form.brand_id);

  function openNew() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setForm({
      id: v.id,
      customer_id: v.customer_id,
      vehicle_number: v.vehicle_number,
      brand_id: v.brand_id ?? "",
      model_id: v.model_id ?? "",
      year: v.year ? String(v.year) : "",
      engine_number: v.engine_number ?? "",
      chassis_number: v.chassis_number ?? "",
      notes: v.notes ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.customer_id) {
      setAlertMessage("Please select a customer.");
      return;
    }
    if (!form.vehicle_number.trim()) {
      setAlertMessage("Please enter the vehicle number.");
      return;
    }
    if (!form.brand_id) {
      setAlertMessage("Please select a vehicle brand.");
      return;
    }
    if (!form.model_id) {
      setAlertMessage("Please select a vehicle model.");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      customer_id: form.customer_id,
      vehicle_number: form.vehicle_number.trim().toUpperCase(),
      brand_id: form.brand_id,
      model_id: form.model_id,
      year: form.year ? Number(form.year) : null,
      engine_number: form.engine_number.trim() || null,
      chassis_number: form.chassis_number.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("vehicles").update(payload).eq("id", form.id)
      : await supabase.from("vehicles").insert(payload);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        setAlertMessage("A vehicle with this vehicle number already exists.");
      } else {
        setError(error.message);
      }
      return;
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    router.refresh();
  }

  function friendlyDeleteError(label: string, error: { code?: string; message: string }): string {
    if (error.code === "23503") {
      return `Can't delete "${label}" — it has related records.`;
    }
    return `${label}: ${error.message}`;
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((v) => prev.has(v.id));
      const next = new Set(prev);
      filtered.forEach((v) => (allSelected ? next.delete(v.id) : next.add(v.id)));
      return next;
    });
  }

  function handleDeleteOne(v: Vehicle) {
    setConfirmDialog({
      message: `Delete vehicle "${v.vehicle_number}"? This can't be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        const { error } = await supabase.from("vehicles").delete().eq("id", v.id);
        setDeleting(false);
        if (error) {
          setDeleteResult({ deleted: 0, failed: 1, errors: [friendlyDeleteError(v.vehicle_number, error)] });
        } else {
          setDeleteResult(null);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(v.id);
            return next;
          });
        }
        router.refresh();
      },
    });
  }

  function handleDeleteSelected() {
    const targets = initialVehicles.filter((v) => selectedIds.has(v.id));
    if (targets.length === 0) return;
    setConfirmDialog({
      message: `Delete ${targets.length} selected vehicle(s)? This can't be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        let deleted = 0;
        const errors: string[] = [];
        for (const v of targets) {
          const { error } = await supabase.from("vehicles").delete().eq("id", v.id);
          if (error) {
            errors.push(friendlyDeleteError(v.vehicle_number, error));
          } else {
            deleted++;
          }
        }
        setDeleting(false);
        setDeleteResult({ deleted, failed: errors.length, errors });
        setSelectedIds(new Set());
        router.refresh();
      },
    });
  }

  async function handleQuickAddCustomer() {
    if (!qcName.trim()) {
      setAlertMessage("The name you have entered is incorrect.");
      return;
    }
    if (!isValidName(qcName)) {
      setAlertMessage("The name you have entered is incorrect.");
      return;
    }
    const fullPhone = combinePhone(qcPhoneCountry, qcPhone);
    if (fullPhone && !isValidPhone(fullPhone)) {
      setAlertMessage("The mobile number you have entered is incorrect.");
      return;
    }
    setQcSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({ name: combineTitleName(qcTitle, qcName), phone: fullPhone || null })
      .select("id, customer_code, name")
      .single();
    setQcSaving(false);
    if (error || !data) {
      setAlertMessage(error?.message ?? "Could not save customer.");
      return;
    }
    setLocalCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, customer_id: data.id }));
    setQcTitle("");
    setQcName("");
    setQcPhone("");
    setQcPhoneCountry(DEFAULT_COUNTRY_CODE);
    setShowAddCustomer(false);
    router.refresh();
  }

  async function handleQuickAddBrand() {
    if (!qbName.trim()) {
      setAlertMessage("Please enter a brand name.");
      return;
    }
    setQbSaving(true);
    const { data, error } = await supabase
      .from("vehicle_brands")
      .insert({ name: qbName.trim() })
      .select("id, name")
      .single();
    setQbSaving(false);
    if (error || !data) {
      setAlertMessage(error?.code === "23505" ? "This brand already exists." : error?.message ?? "Could not save brand.");
      return;
    }
    setLocalBrands((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, brand_id: data.id, model_id: "" }));
    setQbName("");
    setShowAddBrand(false);
    router.refresh();
  }

  async function handleQuickAddModel() {
    if (!form.brand_id) {
      setAlertMessage("Please select a brand first.");
      return;
    }
    if (!qmName.trim()) {
      setAlertMessage("Please enter a model name.");
      return;
    }
    setQmSaving(true);
    const { data, error } = await supabase
      .from("vehicle_models")
      .insert({ brand_id: form.brand_id, name: qmName.trim() })
      .select("id, brand_id, name")
      .single();
    setQmSaving(false);
    if (error || !data) {
      setAlertMessage(error?.code === "23505" ? "This model already exists for the selected brand." : error?.message ?? "Could not save model.");
      return;
    }
    setLocalModels((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((f) => ({ ...f, model_id: data.id }));
    setQmName("");
    setShowAddModel(false);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicle</h1>
          <p className="text-sm text-slate-500">Register and manage customer vehicles.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              title={`Delete ${selectedIds.size} selected vehicle(s)`}
              aria-label="Delete Selected"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path
                  d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                {selectedIds.size}
              </span>
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            Add Vehicle
          </button>
        </div>
      </div>

      {deleteResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span>
              <span className="text-green-700 font-medium">{deleteResult.deleted} deleted</span>
              {deleteResult.failed > 0 && (
                <>
                  {", "}
                  <span className="text-red-600 font-medium">{deleteResult.failed} failed</span>
                </>
              )}
            </span>
            <button onClick={() => setDeleteResult(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          {deleteResult.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-red-600 list-disc pl-4 space-y-0.5">
              {deleteResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by vehicle number, customer, brand, or model..."
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2"
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-4 py-2 font-medium">Vehicle Number</th>
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Brand</th>
              <th className="text-left px-4 py-2 font-medium">Model</th>
              <th className="text-left px-4 py-2 font-medium">Year</th>
              <th className="text-left px-4 py-2 font-medium">Engine Number</th>
              <th className="text-left px-4 py-2 font-medium">Chassis Number</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleSelected(v.id)} />
                </td>
                <td className="px-4 py-2 text-slate-800 font-medium">{v.vehicle_number}</td>
                <td className="px-4 py-2 text-slate-600">
                  {v.customers ? `${v.customers.customer_code} — ${v.customers.name}` : "—"}
                </td>
                <td className="px-4 py-2 text-slate-500">{v.vehicle_brands?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{v.vehicle_models?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{v.year ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{v.engine_number ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{v.chassis_number ?? "—"}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(v)} className="text-blue-600 hover:underline text-xs font-medium">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteOne(v)}
                    className="ml-3 text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No vehicles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">{form.id ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

            <div>
              <label className="text-sm font-bold text-slate-900">Customer *</label>
              <div className="flex gap-2 mt-1">
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <option value="">Select customer</option>
                  {localCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_code} — {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(true)}
                  title="Add new customer"
                  className="w-11 shrink-0 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-900">Vehicle Number *</label>
              <input
                placeholder="Enter vehicle number"
                value={form.vehicle_number}
                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="text-sm font-bold text-slate-900">Brand *</label>
                <div className="flex gap-2 mt-1">
                  <select
                    value={form.brand_id}
                    onChange={(e) => setForm({ ...form, brand_id: e.target.value, model_id: "" })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm"
                  >
                    <option value="">Select vehicle brand</option>
                    {localBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddBrand(true)}
                    title="Add new brand"
                    className="w-11 shrink-0 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="w-1/2">
                <label className="text-sm font-bold text-slate-900">Model *</label>
                <div className="flex gap-2 mt-1">
                  <select
                    value={form.model_id}
                    onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                    disabled={!form.brand_id}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">Select vehicle model</option>
                    {modelsForBrand.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => (form.brand_id ? setShowAddModel(true) : setAlertMessage("Please select a brand first."))}
                    title="Add new model"
                    className="w-11 shrink-0 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="text-sm font-bold text-slate-900">Year</label>
                <input
                  type="number"
                  placeholder="YYYY"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
                />
              </div>
              <div className="w-1/2">
                <label className="text-sm font-bold text-slate-900">Engine Number</label>
                <input
                  placeholder="Enter engine number"
                  value={form.engine_number}
                  onChange={(e) => setForm({ ...form, engine_number: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-900">Chassis Number</label>
              <input
                placeholder="Enter chassis number"
                value={form.chassis_number}
                onChange={(e) => setForm({ ...form, chassis_number: e.target.value })}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-900">Notes</label>
              <textarea
                placeholder="Additional notes about the vehicle"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">Add Customer</h2>
              <button
                onClick={() => setShowAddCustomer(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={qcTitle}
                onChange={(e) => setQcTitle(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm w-24 shrink-0"
              >
                <option value="">Title</option>
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Enter customer name"
                value={qcName}
                onChange={(e) => setQcName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={qcPhoneCountry}
                onChange={(e) => setQcPhoneCountry(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-sm w-40 shrink-0"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.name} value={c.dialCode}>
                    {c.name} ({c.dialCode})
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Enter customer mobile number"
                value={qcPhone}
                onChange={(e) => setQcPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddCustomer(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAddCustomer}
                disabled={qcSaving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {qcSaving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddBrand && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">Add Brand</h2>
              <button
                onClick={() => setShowAddBrand(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-900">Brand name</label>
              <input
                placeholder="e.g. Toyota"
                value={qbName}
                onChange={(e) => setQbName(e.target.value)}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddBrand(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAddBrand}
                disabled={qbSaving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {qbSaving ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">Add Model</h2>
              <button
                onClick={() => setShowAddModel(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-900">Model name</label>
              <input
                placeholder="e.g. Corolla"
                value={qmName}
                onChange={(e) => setQmName(e.target.value)}
                className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModel(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAddModel}
                disabled={qmSaving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {qmSaving ? "Saving..." : "Save Model"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4">
            <p className="text-sm text-slate-700">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAlertMessage(null);
          }}
        >
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4 text-center">
            <p className="text-sm text-slate-700">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
