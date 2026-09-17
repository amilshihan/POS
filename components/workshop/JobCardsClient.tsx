"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TITLES, combineTitleName, isValidName, isValidPhone } from "@/lib/validation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, combinePhone } from "@/lib/countries";
import { JOB_CARD_PRIORITIES, JOB_CARD_STATUSES, jobCardStatusLabel } from "@/lib/workshop";
import {
  modalTitle,
  fieldLabel,
  helperText,
  requiredMark,
  inputBase,
  btnPrimary,
  btnSecondary,
  btnIconSquare,
  cardSurface,
} from "@/lib/ui";

type Customer = { id: string; customer_code: string; name: string };
type VehicleOption = { id: string; customer_id: string; vehicle_number: string };
type Mechanic = { id: string; full_name: string };
type Brand = { id: string; name: string };
type Model = { id: string; brand_id: string; name: string };
type JobCard = {
  id: string;
  job_no: string;
  customer_id: string;
  vehicle_id: string;
  mechanic_id: string | null;
  status: string;
  priority: string;
  total_amount: number;
  created_at: string;
  customers: { customer_code: string; name: string; phone: string | null } | null;
  vehicles: { vehicle_number: string } | null;
  mechanic: { full_name: string } | null;
};

const EMPTY_FORM = {
  customer_id: "",
  vehicle_id: "",
  meter_reading: "",
  complaints: "",
  requested_work: "",
};

function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
function IconWrench({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path
        d="M12.5 3a3.5 3.5 0 0 0-4.6 4.6L3 12.5V17h4.5l4.9-4.9A3.5 3.5 0 0 0 17 7.5l-2.8 2.8-2-2L15 5.5 12.5 3Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAlert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M10 3 18 16H2L10 3Z" strokeLinejoin="round" />
      <path d="M10 8v3.5" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
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

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-surface text-muted",
  medium: "bg-accent-light text-accent",
  high: "bg-error-light text-error",
  urgent: "bg-error text-white",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent-light text-accent",
  in_progress: "bg-accent text-white",
  completed: "bg-surface text-ink",
  cancelled: "bg-error-light text-error",
};

export default function JobCardsClient({
  initialJobCards,
  customers,
  vehicles,
  mechanics,
  brands,
  models,
}: {
  initialJobCards: JobCard[];
  customers: Customer[];
  vehicles: VehicleOption[];
  mechanics: Mechanic[];
  brands: Brand[];
  models: Model[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [localVehicles, setLocalVehicles] = useState(vehicles);
  const [localBrands, setLocalBrands] = useState(brands);
  const [localModels, setLocalModels] = useState(models);

  const [search, setSearch] = useState("");
  const [mechanicFilter, setMechanicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [qcTitle, setQcTitle] = useState("");
  const [qcName, setQcName] = useState("");
  const [qcPhoneCountry, setQcPhoneCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [qcPhone, setQcPhone] = useState("");
  const [qcSaving, setQcSaving] = useState(false);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [qvNumber, setQvNumber] = useState("");
  const [qvBrandId, setQvBrandId] = useState("");
  const [qvModelId, setQvModelId] = useState("");
  const [qvSaving, setQvSaving] = useState(false);

  const available = initialJobCards.filter((j) => j.status !== "completed" && j.status !== "cancelled").length;
  const inProgress = initialJobCards.filter((j) => j.status === "in_progress").length;
  const pending = initialJobCards.filter((j) => j.status === "pending").length;

  const filtered = initialJobCards.filter((j) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      j.job_no.toLowerCase().includes(q) ||
      j.vehicles?.vehicle_number.toLowerCase().includes(q) ||
      j.customers?.name.toLowerCase().includes(q);
    const matchesMechanic = mechanicFilter === "all" || j.mechanic_id === mechanicFilter;
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || j.priority === priorityFilter;
    return matchesSearch && matchesMechanic && matchesStatus && matchesPriority;
  });

  function clearFilters() {
    setSearch("");
    setMechanicFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
  }

  const vehiclesForCustomer = localVehicles.filter((v) => v.customer_id === form.customer_id);
  const modelsForBrand = localModels.filter((m) => m.brand_id === qvBrandId);

  function openNew() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleCreate() {
    if (!form.customer_id) {
      setAlertMessage("Please select a customer.");
      return;
    }
    if (!form.vehicle_id) {
      setAlertMessage("Please select a vehicle.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("job_cards")
      .insert({
        customer_id: form.customer_id,
        vehicle_id: form.vehicle_id,
        meter_reading: form.meter_reading ? Number(form.meter_reading) : null,
        complaints: form.complaints.trim() || null,
        requested_work: form.requested_work.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setAlertMessage(error?.message ?? "Could not create job card.");
      return;
    }
    router.push(`/workshop/job-cards/${data.id}`);
  }

  async function handleQuickAddCustomer() {
    if (!qcName.trim() || !isValidName(qcName)) {
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
    setForm((f) => ({ ...f, customer_id: data.id, vehicle_id: "" }));
    setQcTitle("");
    setQcName("");
    setQcPhone("");
    setQcPhoneCountry(DEFAULT_COUNTRY_CODE);
    setShowAddCustomer(false);
    router.refresh();
  }

  async function handleQuickAddVehicle() {
    if (!form.customer_id) {
      setAlertMessage("Please select a customer first.");
      return;
    }
    if (!qvNumber.trim() || !qvBrandId || !qvModelId) {
      setAlertMessage("Please fill in vehicle number, brand, and model.");
      return;
    }
    setQvSaving(true);
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        customer_id: form.customer_id,
        vehicle_number: qvNumber.trim().toUpperCase(),
        brand_id: qvBrandId,
        model_id: qvModelId,
      })
      .select("id, customer_id, vehicle_number")
      .single();
    setQvSaving(false);
    if (error || !data) {
      setAlertMessage(
        error?.code === "23505" ? "A vehicle with this number already exists." : error?.message ?? "Could not save vehicle."
      );
      return;
    }
    setLocalVehicles((prev) => [...prev, data]);
    setForm((f) => ({ ...f, vehicle_id: data.id }));
    setQvNumber("");
    setQvBrandId("");
    setQvModelId("");
    setShowAddVehicle(false);
    router.refresh();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Work Orders</h1>
          <p className="text-sm text-muted">Create, manage, and track all your workshop jobs in one place.</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>
          <IconPlus className="w-4 h-4" />
          New Job Card
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${cardSurface} p-4 flex items-center justify-between`}>
          <div>
            <p className="text-xs font-medium text-accent">Available Jobs</p>
            <p className="text-2xl font-bold text-ink mt-1">{available}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent shrink-0">
            <IconWrench className="w-5 h-5" />
          </div>
        </div>
        <div className={`${cardSurface} p-4 flex items-center justify-between`}>
          <div>
            <p className="text-xs font-medium text-accent">In Progress</p>
            <p className="text-2xl font-bold text-ink mt-1">{inProgress}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent shrink-0">
            <IconClock className="w-5 h-5" />
          </div>
        </div>
        <div className={`${cardSurface} p-4 flex items-center justify-between`}>
          <div>
            <p className="text-xs font-medium text-accent">Pending</p>
            <p className="text-2xl font-bold text-ink mt-1">{pending}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-accent shrink-0">
            <IconAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className={helperText}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Job No, Vehicle No or Customer..."
              className={`${inputBase} mt-1`}
            />
          </div>
          <div>
            <label className={helperText}>Mechanic</label>
            <select value={mechanicFilter} onChange={(e) => setMechanicFilter(e.target.value)} className={`${inputBase} mt-1`}>
              <option value="all">All</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={helperText}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputBase} mt-1`}>
              <option value="all">All</option>
              {JOB_CARD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {jobCardStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={helperText}>Priority</label>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={`${inputBase} mt-1`}>
              <option value="all">All</option>
              {JOB_CARD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
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
              <th className="text-left px-4 py-2 font-medium">Job No</th>
              <th className="text-left px-4 py-2 font-medium">Date/Time</th>
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Vehicle No</th>
              <th className="text-left px-4 py-2 font-medium">Mechanic</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Priority</th>
              <th className="text-right px-4 py-2 font-medium">Total Amount</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card">
            {filtered.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2 text-ink font-medium">{j.job_no}</td>
                <td className="px-4 py-2 text-muted">{new Date(j.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-ink">
                  {j.customers ? `${j.customers.name}${j.customers.phone ? ` - ${j.customers.phone}` : ""}` : "—"}
                </td>
                <td className="px-4 py-2 text-ink">{j.vehicles?.vehicle_number ?? "—"}</td>
                <td className="px-4 py-2 text-muted italic">{j.mechanic?.full_name ?? "Not Set"}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[j.status]}`}>
                    {jobCardStatusLabel(j.status)}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_STYLES[j.priority]}`}>
                    {j.priority.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-ink">LKR {j.total_amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => router.push(`/workshop/job-cards/${j.id}`)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent-light"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  No job cards found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className={modalTitle}>Create Job Card</h2>
                <p className="text-sm text-muted">
                  Job No <span className="uppercase tracking-wide">auto-generated</span>
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div>
              <label className={fieldLabel}>
                Customer <span className={requiredMark}>*</span>
              </label>
              <div className="flex gap-2 mt-1">
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value, vehicle_id: "" })}
                  className={inputBase}
                >
                  <option value="">Select customer</option>
                  {localCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_code} — {c.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddCustomer(true)} title="Add new customer" className={btnIconSquare}>
                  <IconPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>
                Vehicle <span className={requiredMark}>*</span>
              </label>
              <div className="flex gap-2 mt-1">
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                  disabled={!form.customer_id}
                  className={`${inputBase} disabled:opacity-60`}
                >
                  <option value="">Select vehicle</option>
                  {vehiclesForCustomer.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => (form.customer_id ? setShowAddVehicle(true) : setAlertMessage("Please select a customer first."))}
                  title="Add new vehicle"
                  className={btnIconSquare}
                >
                  <IconPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Meter Reading (optional)</label>
              <input
                type="number"
                placeholder="0"
                value={form.meter_reading}
                onChange={(e) => setForm({ ...form, meter_reading: e.target.value })}
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={fieldLabel}>Complaints (optional)</label>
              <textarea
                placeholder="Enter customer complaints"
                value={form.complaints}
                onChange={(e) => setForm({ ...form, complaints: e.target.value })}
                rows={2}
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={fieldLabel}>Requested Work (optional)</label>
              <textarea
                placeholder="Enter requested work"
                value={form.requested_work}
                onChange={(e) => setForm({ ...form, requested_work: e.target.value })}
                rows={2}
                className={`${inputBase} mt-1`}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving} className={btnPrimary}>
                {saving ? "Creating..." : "Create Job Card"}
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
              <button onClick={() => setShowAddCustomer(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={qcTitle} onChange={(e) => setQcTitle(e.target.value)} className={`${inputBase} w-full sm:w-24 shrink-0`}>
                <option value="">Title</option>
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input placeholder="Enter customer name" value={qcName} onChange={(e) => setQcName(e.target.value)} className={inputBase} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
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

      {showAddVehicle && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">Add Vehicle</h2>
              <button onClick={() => setShowAddVehicle(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>Vehicle Number</label>
              <input
                placeholder="e.g. WP-CA-1234"
                value={qvNumber}
                onChange={(e) => setQvNumber(e.target.value)}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div>
              <label className={fieldLabel}>Brand</label>
              <select
                value={qvBrandId}
                onChange={(e) => {
                  setQvBrandId(e.target.value);
                  setQvModelId("");
                }}
                className={`${inputBase} mt-1`}
              >
                <option value="">Select vehicle brand</option>
                {localBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>Model</label>
              <select
                value={qvModelId}
                onChange={(e) => setQvModelId(e.target.value)}
                disabled={!qvBrandId}
                className={`${inputBase} mt-1 disabled:opacity-60`}
              >
                <option value="">Select vehicle model</option>
                {modelsForBrand.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddVehicle(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleQuickAddVehicle} disabled={qvSaving} className={btnPrimary}>
                {qvSaving ? "Saving..." : "Save Vehicle"}
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
