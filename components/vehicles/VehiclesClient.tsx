"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TITLES, combineTitleName, isValidName, isValidPhone } from "@/lib/validation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, combinePhone } from "@/lib/countries";
import {
  modalTitle,
  fieldLabel,
  helperText,
  requiredMark,
  inputBase,
  inputWithIcon,
  iconLeft,
  iconLeftTop,
  btnPrimary,
  btnSecondary,
  btnIconSquare,
  iconActionBtn,
  iconActionBtnDanger,
  cardSurface,
  twoColRow,
} from "@/lib/ui";

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
  customers: { customer_code: string; name: string; phone: string | null } | null;
  vehicle_brands: { name: string } | null;
  vehicle_models: { name: string } | null;
};

function IconCar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 12.5 4.3 8a2 2 0 0 1 1.9-1.4h7.6A2 2 0 0 1 15.7 8l1.3 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="12.5" width="16" height="3.5" rx="1" />
      <circle cx="5.5" cy="16" r="1.3" />
      <circle cx="14.5" cy="16" r="1.3" />
    </svg>
  );
}
function IconFilters({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
      <circle cx="7" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="9" cy="9" r="6" />
      <path d="M17 17l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
function IconPencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.5 17c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" strokeLinecap="round" />
    </svg>
  );
}
function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="4" y="2.5" width="9" height="15" rx="1" />
      <path
        d="M6.5 5.5h1M9.5 5.5h1M6.5 8.5h1M9.5 8.5h1M6.5 11.5h1M9.5 11.5h1M7.5 17.5V15h2v2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
    </svg>
  );
}
function IconEngine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="10" cy="11" r="6" />
      <path d="M10 11 13 8" strokeLinecap="round" />
      <path d="M7 4.5h6" strokeLinecap="round" />
    </svg>
  );
}
function IconBarcode({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 4v12M6 4v12M8 4v12M11 4v12M13 4v12M16 4v12" strokeLinecap="round" />
    </svg>
  );
}
function IconFileText({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M5 2.5h7l3 3V17a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 17V2.5Z" strokeLinejoin="round" />
      <path d="M7 10h6M7 13h6" strokeLinecap="round" />
    </svg>
  );
}
function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [brandFilter, setBrandFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [localBrands, setLocalBrands] = useState(brands);
  const [localModels, setLocalModels] = useState(models);

  const [viewing, setViewing] = useState<Vehicle | null>(null);
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
    const matchesSearch =
      !q ||
      v.vehicle_number.toLowerCase().includes(q) ||
      v.customers?.name.toLowerCase().includes(q) ||
      v.customers?.customer_code.toLowerCase().includes(q) ||
      v.vehicle_brands?.name.toLowerCase().includes(q) ||
      v.vehicle_models?.name.toLowerCase().includes(q);
    const matchesBrand = brandFilter === "all" || v.brand_id === brandFilter;
    const matchesModel = modelFilter === "all" || v.model_id === modelFilter;
    return matchesSearch && matchesBrand && matchesModel;
  });

  function clearFilters() {
    setSearch("");
    setBrandFilter("all");
    setModelFilter("all");
  }

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
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Vehicles</h1>
          <p className="text-sm text-muted">Manage all vehicles registered in your garage.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              title={`Delete ${selectedIds.size} selected vehicle(s)`}
              aria-label="Delete Selected"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-error/30 text-error hover:bg-error-light"
            >
              <IconTrash className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-semibold flex items-center justify-center">
                {selectedIds.size}
              </span>
            </button>
          )}
          <button onClick={openNew} className={btnPrimary}>
            <IconPlus className="w-4 h-4" />
            New Vehicle
          </button>
        </div>
      </div>

      <div className={`${cardSurface} p-4 w-full sm:w-64 flex items-center justify-between`}>
        <div>
          <p className="text-xs font-medium text-accent">Registered Vehicles</p>
          <p className="text-2xl font-bold text-ink mt-1">{initialVehicles.length}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent shrink-0">
          <IconCar className="w-5 h-5" />
        </div>
      </div>

      {deleteResult && (
        <div className={`${cardSurface} p-3 text-sm space-y-1`}>
          <div className="flex items-center justify-between">
            <span>
              <span className="text-accent font-medium">{deleteResult.deleted} deleted</span>
              {deleteResult.failed > 0 && (
                <>
                  {", "}
                  <span className="text-error font-medium">{deleteResult.failed} failed</span>
                </>
              )}
            </span>
            <button onClick={() => setDeleteResult(null)} className="text-muted hover:text-ink">
              ✕
            </button>
          </div>
          {deleteResult.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-error list-disc pl-4 space-y-0.5">
              {deleteResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`${cardSurface} p-4 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <IconFilters className="w-4 h-4" />
            Filters
          </div>
          <button
            onClick={clearFilters}
            className="text-sm px-3 py-1.5 rounded-lg border border-input text-muted hover:bg-surface hover:text-ink"
          >
            Clear
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_200px] gap-4">
          <div>
            <label className={helperText}>Search</label>
            <div className="relative mt-1">
              <IconSearch className={iconLeft} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer name, mobile, or vehicle no..."
                className={inputWithIcon}
              />
            </div>
          </div>
          <div>
            <label className={helperText}>Brand</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className={`${inputBase} mt-1`}
            >
              <option value="all">All</option>
              {localBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={helperText}>Model</label>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className={`${inputBase} mt-1`}
            >
              <option value="all">All</option>
              {localModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={`${cardSurface} overflow-hidden overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-4 py-2 font-medium">Vehicle No</th>
              <th className="text-left px-4 py-2 font-medium">Brand</th>
              <th className="text-left px-4 py-2 font-medium">Model</th>
              <th className="text-left px-4 py-2 font-medium">Year</th>
              <th className="text-left px-4 py-2 font-medium">Engine No</th>
              <th className="text-left px-4 py-2 font-medium">Chassis No</th>
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card">
            {filtered.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleSelected(v.id)} />
                </td>
                <td className="px-4 py-2 text-ink font-bold">{v.vehicle_number}</td>
                <td className="px-4 py-2 text-ink">{v.vehicle_brands?.name ?? "—"}</td>
                <td className="px-4 py-2 text-ink">{v.vehicle_models?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted">{v.year ?? "—"}</td>
                <td className="px-4 py-2 text-muted">{v.engine_number ?? "—"}</td>
                <td className="px-4 py-2 text-muted">{v.chassis_number ?? "—"}</td>
                <td className="px-4 py-2 text-ink">
                  {v.customers ? `${v.customers.name}${v.customers.phone ? ` - ${v.customers.phone}` : ""}` : "—"}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(v)} title="Edit" aria-label="Edit" className={iconActionBtn}>
                      <IconPencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewing(v)} title="View" aria-label="View" className={iconActionBtn}>
                      <IconEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOne(v)}
                      title="Delete"
                      aria-label="Delete"
                      className={iconActionBtnDanger}
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  No vehicles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent shrink-0">
                  <IconCar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={modalTitle}>{form.id ? "Edit Vehicle" : "Add Vehicle"}</h2>
                  <p className="text-sm text-muted">
                    {form.id ? "Update vehicle details" : "Add a new vehicle to the system"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            {error && <div className="rounded-lg bg-error-light text-error text-sm px-3 py-2">{error}</div>}

            <div>
              <label className={fieldLabel}>
                Customer <span className={requiredMark}>*</span>
              </label>
              <div className="flex gap-2 mt-1">
                <div className="relative w-full">
                  <IconUser className={iconLeft} />
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    className={inputWithIcon}
                  >
                    <option value="">Select customer</option>
                    {localCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(true)}
                  title="Add new customer"
                  className={btnIconSquare}
                >
                  <IconPlus className="w-4 h-4" />
                </button>
              </div>
              <p className={`${helperText} mt-1`}>Select the customer who owns this vehicle</p>
            </div>

            <div>
              <label className={fieldLabel}>
                Vehicle Number <span className={requiredMark}>*</span>
              </label>
              <div className="relative mt-1">
                <IconCar className={iconLeft} />
                <input
                  placeholder="Enter vehicle number"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                  className={inputWithIcon}
                />
              </div>
              <p className={`${helperText} mt-1`}>e.g. WP-CA-1234</p>
            </div>

            <div className={twoColRow}>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Brand <span className={requiredMark}>*</span>
                </label>
                <div className="flex gap-2 mt-1">
                  <div className="relative w-full">
                    <IconBuilding className={iconLeft} />
                    <select
                      value={form.brand_id}
                      onChange={(e) => setForm({ ...form, brand_id: e.target.value, model_id: "" })}
                      className={inputWithIcon}
                    >
                      <option value="">Select vehicle brand</option>
                      {localBrands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddBrand(true)}
                    title="Add new brand"
                    className={btnIconSquare}
                  >
                    <IconPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Model <span className={requiredMark}>*</span>
                </label>
                <div className="flex gap-2 mt-1">
                  <div className="relative w-full">
                    <IconCar className={iconLeft} />
                    <select
                      value={form.model_id}
                      onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                      disabled={!form.brand_id}
                      className={inputWithIcon}
                    >
                      <option value="">Select vehicle model</option>
                      {modelsForBrand.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => (form.brand_id ? setShowAddModel(true) : setAlertMessage("Please select a brand first."))}
                    title="Add new model"
                    className={btnIconSquare}
                  >
                    <IconPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className={twoColRow}>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Year</label>
                <div className="relative mt-1">
                  <IconCalendar className={iconLeft} />
                  <input
                    type="number"
                    placeholder="YYYY"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className={inputWithIcon}
                  />
                </div>
                <p className={`${helperText} mt-1`}>e.g. 2018</p>
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Engine Number</label>
                <div className="relative mt-1">
                  <IconEngine className={iconLeft} />
                  <input
                    placeholder="Enter engine number"
                    value={form.engine_number}
                    onChange={(e) => setForm({ ...form, engine_number: e.target.value })}
                    className={inputWithIcon}
                  />
                </div>
                <p className={`${helperText} mt-1`}>e.g. G4LA123456</p>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Chassis Number</label>
              <div className="relative mt-1">
                <IconBarcode className={iconLeft} />
                <input
                  placeholder="Enter chassis number"
                  value={form.chassis_number}
                  onChange={(e) => setForm({ ...form, chassis_number: e.target.value })}
                  className={inputWithIcon}
                />
              </div>
              <p className={`${helperText} mt-1`}>e.g. KNAB2511BJT123456</p>
            </div>

            <div>
              <label className={fieldLabel}>Notes</label>
              <div className="relative mt-1">
                <IconFileText className={iconLeftTop} />
                <textarea
                  placeholder="Additional notes about the vehicle (optional)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className={inputWithIcon}
                />
              </div>
            </div>

            <hr className="border-card" />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className={btnPrimary}>
                <IconPlus className="w-4 h-4" />
                {saving ? "Saving..." : form.id ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCustomer && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">Add Customer</h2>
              <button
                onClick={() => setShowAddCustomer(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className={twoColRow}>
              <select
                value={qcTitle}
                onChange={(e) => setQcTitle(e.target.value)}
                className={`${inputBase} w-full sm:w-24 shrink-0`}
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
                className={inputBase}
              />
            </div>
            <div className={twoColRow}>
              <select
                value={qcPhoneCountry}
                onChange={(e) => setQcPhoneCountry(e.target.value)}
                className={`${inputBase} w-full sm:w-40 shrink-0`}
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
                className={inputBase}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddCustomer(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleQuickAddCustomer} disabled={qcSaving} className={btnPrimary}>
                {qcSaving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddBrand && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">Add Brand</h2>
              <button
                onClick={() => setShowAddBrand(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>Brand name</label>
              <input
                placeholder="e.g. Toyota"
                value={qbName}
                onChange={(e) => setQbName(e.target.value)}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddBrand(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleQuickAddBrand} disabled={qbSaving} className={btnPrimary}>
                {qbSaving ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModel && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">Add Model</h2>
              <button
                onClick={() => setShowAddModel(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>Model name</label>
              <input
                placeholder="e.g. Corolla"
                value={qmName}
                onChange={(e) => setQmName(e.target.value)}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModel(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleQuickAddModel} disabled={qmSaving} className={btnPrimary}>
                {qmSaving ? "Saving..." : "Save Model"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">Vehicle Details</h2>
              <button
                onClick={() => setViewing(null)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <dl className="text-sm divide-y divide-card">
              {[
                ["Vehicle No", viewing.vehicle_number],
                ["Brand", viewing.vehicle_brands?.name ?? "—"],
                ["Model", viewing.vehicle_models?.name ?? "—"],
                ["Year", viewing.year ?? "—"],
                ["Engine No", viewing.engine_number ?? "—"],
                ["Chassis No", viewing.chassis_number ?? "—"],
                [
                  "Customer",
                  viewing.customers
                    ? `${viewing.customers.name}${viewing.customers.phone ? ` - ${viewing.customers.phone}` : ""}`
                    : "—",
                ],
                ["Notes", viewing.notes ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-ink font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewing(null)} className={btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4">
            <p className="text-sm text-ink">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} disabled={deleting} className={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                disabled={deleting}
                className="px-5 py-2.5 rounded-lg bg-error text-white text-sm font-semibold hover:bg-error-hover disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAlertMessage(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4 text-center">
            <p className="text-sm text-ink">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
