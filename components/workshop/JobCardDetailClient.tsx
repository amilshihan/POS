"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { jobCardStatusLabel } from "@/lib/workshop";
import {
  modalTitle,
  fieldLabel,
  helperText,
  requiredMark,
  inputBase,
  btnPrimary,
  btnSecondary,
  cardSurface,
} from "@/lib/ui";

type JobCard = {
  id: string;
  job_no: string;
  customer_id: string;
  vehicle_id: string;
  mechanic_id: string | null;
  meter_reading: number | null;
  complaints: string | null;
  requested_work: string | null;
  status: string;
  priority: string;
  est_completion_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  service_notes: string | null;
  internal_notes: string | null;
  total_labor_cost: number;
  total_parts_cost: number;
  total_amount: number;
  created_at: string;
  customers: {
    id: string;
    customer_code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    credit_limit: number;
  } | null;
  vehicles: {
    id: string;
    vehicle_number: string;
    year: number | null;
    engine_number: string | null;
    chassis_number: string | null;
    notes: string | null;
    vehicle_brands: { name: string } | null;
    vehicle_models: { name: string } | null;
  } | null;
  mechanic: { id: string; full_name: string } | null;
};

type ServiceRow = {
  id: string;
  service_type_id: string | null;
  custom_service_name: string | null;
  labor_charge: number;
  est_time_mins: number | null;
  performed_by: string | null;
  description: string | null;
  status: string;
  service_types: { name: string } | null;
  performed_by_profile: { full_name: string } | null;
};

type PartRow = {
  id: string;
  part_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  parts: { sku: string | null; name: string } | null;
};

type ServiceTypeOption = { id: string; name: string; default_labor_charge: number; estimated_time_mins: number | null };
type Mechanic = { id: string; full_name: string };
type ProductOption = { id: string; sku: string | null; name: string; sell_price: number; qty_on_hand: number };

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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-accent-light text-accent",
  in_progress: "bg-accent text-white",
  completed: "bg-surface text-ink",
  cancelled: "bg-error-light text-error",
};

function fmtDate(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}
function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function JobCardDetailClient({
  jobCard,
  services,
  parts,
  serviceTypes,
  mechanics,
  products,
}: {
  jobCard: JobCard;
  services: ServiceRow[];
  parts: PartRow[];
  serviceTypes: ServiceTypeOption[];
  mechanics: Mechanic[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    mechanic_id: jobCard.mechanic_id ?? "",
    priority: jobCard.priority,
    est_completion_time: toDatetimeLocal(jobCard.est_completion_time),
    service_notes: jobCard.service_notes ?? "",
    internal_notes: jobCard.internal_notes ?? "",
  });

  const [showQuote, setShowQuote] = useState(false);

  const [showAddService, setShowAddService] = useState(false);
  const [svcCustom, setSvcCustom] = useState(false);
  const [svcServiceTypeId, setSvcServiceTypeId] = useState("");
  const [svcCustomName, setSvcCustomName] = useState("");
  const [svcLaborCharge, setSvcLaborCharge] = useState("0");
  const [svcEstTime, setSvcEstTime] = useState("");
  const [svcPerformedBy, setSvcPerformedBy] = useState("");
  const [svcDescription, setSvcDescription] = useState("");
  const [svcSaving, setSvcSaving] = useState(false);

  const [showAddPart, setShowAddPart] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partProductId, setPartProductId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partUnitPrice, setPartUnitPrice] = useState("0");
  const [partSaving, setPartSaving] = useState(false);

  const canTransition = jobCard.status !== "completed" && jobCard.status !== "cancelled";
  const nextStatusLabel = jobCard.status === "in_progress" ? "Mark as completed" : "Mark as in progress";

  async function handleTransition() {
    setBusy(true);
    const nowIso = new Date().toISOString();
    const payload =
      jobCard.status === "in_progress"
        ? { status: "completed", completed_at: nowIso }
        : { status: "in_progress", started_at: nowIso };
    const { error } = await supabase.from("job_cards").update(payload).eq("id", jobCard.id);
    setBusy(false);
    if (error) {
      setAlertMessage(error.message);
      return;
    }
    router.refresh();
  }

  function handleCancelJob() {
    setConfirmDialog({
      message: `Cancel job ${jobCard.job_no}? This can't be undone.`,
      onConfirm: async () => {
        setBusy(true);
        const { error } = await supabase.from("job_cards").update({ status: "cancelled" }).eq("id", jobCard.id);
        setBusy(false);
        if (error) setAlertMessage(error.message);
        router.refresh();
      },
    });
  }

  async function handleSaveEdit() {
    setBusy(true);
    const { error } = await supabase
      .from("job_cards")
      .update({
        mechanic_id: editForm.mechanic_id || null,
        priority: editForm.priority,
        est_completion_time: editForm.est_completion_time ? new Date(editForm.est_completion_time).toISOString() : null,
        service_notes: editForm.service_notes.trim() || null,
        internal_notes: editForm.internal_notes.trim() || null,
      })
      .eq("id", jobCard.id);
    setBusy(false);
    if (error) {
      setAlertMessage(error.message);
      return;
    }
    setShowEdit(false);
    router.refresh();
  }

  function openAddService() {
    setSvcCustom(false);
    setSvcServiceTypeId("");
    setSvcCustomName("");
    setSvcLaborCharge("0");
    setSvcEstTime("");
    setSvcPerformedBy("");
    setSvcDescription("");
    setShowAddService(true);
  }

  async function handleSaveService() {
    if (svcCustom && !svcCustomName.trim()) {
      setAlertMessage("Please enter a custom service name.");
      return;
    }
    if (!svcCustom && !svcServiceTypeId) {
      setAlertMessage("Please select a standard service.");
      return;
    }
    setSvcSaving(true);
    const { error } = await supabase.from("job_card_services").insert({
      job_card_id: jobCard.id,
      service_type_id: svcCustom ? null : svcServiceTypeId,
      custom_service_name: svcCustom ? svcCustomName.trim() : null,
      labor_charge: Number(svcLaborCharge) || 0,
      est_time_mins: svcEstTime ? Number(svcEstTime) : null,
      performed_by: svcPerformedBy || null,
      description: svcDescription.trim() || null,
    });
    setSvcSaving(false);
    if (error) {
      setAlertMessage(error.message);
      return;
    }
    setShowAddService(false);
    router.refresh();
  }

  function handleDeleteService(s: ServiceRow) {
    setConfirmDialog({
      message: `Remove "${s.service_types?.name ?? s.custom_service_name}" from this job card?`,
      onConfirm: async () => {
        setBusy(true);
        const { error } = await supabase.from("job_card_services").delete().eq("id", s.id);
        setBusy(false);
        if (error) setAlertMessage(error.message);
        router.refresh();
      },
    });
  }

  function openAddPart() {
    setPartSearch("");
    setPartProductId("");
    setPartQty("1");
    setPartUnitPrice("0");
    setShowAddPart(true);
  }

  const filteredProducts = products.filter((p) => {
    const q = partSearch.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  async function handleSavePart() {
    if (!partProductId) {
      setAlertMessage("Please select a product.");
      return;
    }
    setPartSaving(true);
    const { error } = await supabase.from("job_card_parts").insert({
      job_card_id: jobCard.id,
      part_id: partProductId,
      qty: Number(partQty) || 1,
      unit_price: Number(partUnitPrice) || 0,
    });
    setPartSaving(false);
    if (error) {
      setAlertMessage(error.message);
      return;
    }
    setShowAddPart(false);
    router.refresh();
  }

  function handleDeletePart(p: PartRow) {
    setConfirmDialog({
      message: `Remove "${p.parts?.name}" from this job card?`,
      onConfirm: async () => {
        setBusy(true);
        const { error } = await supabase.from("job_card_parts").delete().eq("id", p.id);
        setBusy(false);
        if (error) setAlertMessage(error.message);
        router.refresh();
      },
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-ink">{jobCard.job_no}</h1>
          <p className="text-sm text-muted">Job card view</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} className={btnSecondary}>
            Print
          </button>
          <button onClick={() => setShowQuote(true)} className={btnSecondary}>
            Get Quote
          </button>
          {canTransition && (
            <button onClick={handleTransition} disabled={busy} className={btnPrimary}>
              {nextStatusLabel}
            </button>
          )}
          {canTransition && (
            <button
              onClick={handleCancelJob}
              disabled={busy}
              className="px-5 py-2.5 rounded-lg bg-error text-white text-sm font-semibold hover:bg-error-hover disabled:opacity-60"
            >
              Cancel Job
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardSurface} p-5 lg:col-span-2 space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Job Details</h2>
            <button onClick={() => setShowEdit(true)} className="text-sm text-accent hover:underline print:hidden">
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className={helperText}>Date</dt>
              <dd className="text-ink font-medium">{fmtDate(jobCard.created_at)}</dd>
            </div>
            <div>
              <dt className={helperText}>Time</dt>
              <dd className="text-ink font-medium">{fmtTime(jobCard.created_at)}</dd>
            </div>
            <div>
              <dt className={helperText}>Assigned Mechanic</dt>
              <dd className="text-ink font-medium">{jobCard.mechanic?.full_name ?? "N/A"}</dd>
            </div>
            <div>
              <dt className={helperText}>Status</dt>
              <dd>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[jobCard.status]}`}>
                  {jobCardStatusLabel(jobCard.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className={helperText}>Started At</dt>
              <dd className="text-ink font-medium">{fmtDateTime(jobCard.started_at)}</dd>
            </div>
            <div>
              <dt className={helperText}>Completed At</dt>
              <dd className="text-ink font-medium">{fmtDateTime(jobCard.completed_at)}</dd>
            </div>
            <div>
              <dt className={helperText}>Est. Completion Time</dt>
              <dd className="text-ink font-medium">{fmtDateTime(jobCard.est_completion_time)}</dd>
            </div>
            <div>
              <dt className={helperText}>Priority</dt>
              <dd className="text-ink font-medium">{jobCard.priority.toUpperCase()}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className={helperText}>Complaints</dt>
              <dd className="text-ink">{jobCard.complaints ?? "N/A"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className={helperText}>Requested Work</dt>
              <dd className="text-ink">{jobCard.requested_work ?? "N/A"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className={helperText}>Service Notes</dt>
              <dd className="text-ink">{jobCard.service_notes ?? "N/A"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className={helperText}>Internal Notes</dt>
              <dd className="text-ink">{jobCard.internal_notes ?? "N/A"}</dd>
            </div>
          </dl>
          <hr className="border-card" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className={helperText}>Total Labor Cost</dt>
              <dd className="text-ink font-semibold">LKR {jobCard.total_labor_cost.toFixed(2)}</dd>
            </div>
            <div>
              <dt className={helperText}>Total Parts Cost</dt>
              <dd className="text-ink font-semibold">LKR {jobCard.total_parts_cost.toFixed(2)}</dd>
            </div>
            <div>
              <dt className={helperText}>Total Amount</dt>
              <dd className="text-accent font-bold">LKR {jobCard.total_amount.toFixed(2)}</dd>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${cardSurface} p-5 space-y-3`}>
            <h2 className="text-lg font-semibold text-ink">Vehicle Details</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Vehicle Number", jobCard.vehicles?.vehicle_number ?? "N/A"],
                ["Brand", jobCard.vehicles?.vehicle_brands?.name ?? "N/A"],
                ["Model", jobCard.vehicles?.vehicle_models?.name ?? "N/A"],
                ["Year", jobCard.vehicles?.year ?? "N/A"],
                ["Engine Number", jobCard.vehicles?.engine_number ?? "N/A"],
                ["Chassis Number", jobCard.vehicles?.chassis_number ?? "N/A"],
                ["Odometer Reading", jobCard.meter_reading ? `${jobCard.meter_reading} Km` : "N/A"],
                ["Notes", jobCard.vehicles?.notes ?? "N/A"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-ink font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={`${cardSurface} p-5 space-y-3`}>
            <h2 className="text-lg font-semibold text-ink">Customer Details</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Customer Name", jobCard.customers?.name ?? "N/A"],
                ["Mobile Number", jobCard.customers?.phone ?? "N/A"],
                ["Email Address", jobCard.customers?.email ?? "N/A"],
                ["Address", jobCard.customers?.address ?? "N/A"],
                ["Credit Limit", jobCard.customers?.credit_limit ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-ink font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className={`${cardSurface} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Job Card Services</h2>
            <p className={helperText}>Add or manage services on the job card</p>
          </div>
          <button onClick={openAddService} className={`${btnPrimary} print:hidden`}>
            Add Service
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Service Name</th>
                <th className="text-left px-3 py-2 font-medium">Performed By</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Labor Charge</th>
                <th className="px-3 py-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card">
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-ink">{s.service_types?.name ?? s.custom_service_name}</td>
                  <td className="px-3 py-2 text-muted">{s.performed_by_profile?.full_name ?? "Unassigned"}</td>
                  <td className="px-3 py-2 text-muted capitalize">{s.status}</td>
                  <td className="px-3 py-2 text-right text-ink">LKR {s.labor_charge.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <button onClick={() => handleDeleteService(s)} title="Remove" aria-label="Remove" className="text-error hover:underline text-xs">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    No services added.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${cardSurface} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Job Card Parts</h2>
            <p className={helperText}>Add or manage items used on the job card</p>
          </div>
          <button onClick={openAddPart} className={`${btnPrimary} print:hidden`}>
            Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                <th className="text-left px-3 py-2 font-medium">Product Name</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card">
              {parts.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-muted font-mono text-xs">{p.parts?.sku ?? "—"}</td>
                  <td className="px-3 py-2 text-ink">{p.parts?.name}</td>
                  <td className="px-3 py-2 text-right text-ink">{p.qty}</td>
                  <td className="px-3 py-2 text-right text-ink">LKR {p.unit_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-ink">LKR {p.line_total.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <button onClick={() => handleDeletePart(p)} title="Remove" aria-label="Remove" className="text-error hover:underline text-xs">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    No parts added.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEdit && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>Edit Job Details</h2>
              <button onClick={() => setShowEdit(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>Job No</label>
              <p className="text-sm text-muted mt-1">{jobCard.job_no}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Mechanic</label>
                <select
                  value={editForm.mechanic_id}
                  onChange={(e) => setEditForm({ ...editForm, mechanic_id: e.target.value })}
                  className={`${inputBase} mt-1`}
                >
                  <option value="">Select Mechanic</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className={`${inputBase} mt-1`}
                >
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="urgent">URGENT</option>
                </select>
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Est. Completion Time</label>
              <input
                type="datetime-local"
                value={editForm.est_completion_time}
                onChange={(e) => setEditForm({ ...editForm, est_completion_time: e.target.value })}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div>
              <label className={fieldLabel}>Service Notes (optional)</label>
              <textarea
                placeholder="Enter service notes"
                value={editForm.service_notes}
                onChange={(e) => setEditForm({ ...editForm, service_notes: e.target.value })}
                rows={2}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div>
              <label className={fieldLabel}>Internal Notes (optional)</label>
              <textarea
                placeholder="Enter internal notes"
                value={editForm.internal_notes}
                onChange={(e) => setEditForm({ ...editForm, internal_notes: e.target.value })}
                rows={2}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowEdit(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={busy} className={btnPrimary}>
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddService && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>Add Service</h2>
              <button onClick={() => setShowAddService(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <div className="flex items-center justify-between border border-card rounded-xl p-4">
              <div>
                <p className="text-base font-semibold text-ink">Custom Service</p>
                <p className={helperText}>Add a one off service not in the catalog</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={svcCustom}
                onClick={() => setSvcCustom((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  svcCustom ? "bg-accent" : "bg-card"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    svcCustom ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {svcCustom ? (
              <div>
                <label className={fieldLabel}>
                  Custom Service Name <span className={requiredMark}>*</span>
                </label>
                <input
                  placeholder="e.g. Custom repair"
                  value={svcCustomName}
                  onChange={(e) => setSvcCustomName(e.target.value)}
                  className={`${inputBase} mt-1`}
                />
              </div>
            ) : (
              <div>
                <label className={fieldLabel}>
                  Standard Service <span className={requiredMark}>*</span>
                </label>
                <select
                  value={svcServiceTypeId}
                  onChange={(e) => {
                    const st = serviceTypes.find((s) => s.id === e.target.value);
                    setSvcServiceTypeId(e.target.value);
                    if (st) {
                      setSvcLaborCharge(String(st.default_labor_charge));
                      setSvcEstTime(st.estimated_time_mins ? String(st.estimated_time_mins) : "");
                    }
                  }}
                  className={`${inputBase} mt-1`}
                >
                  <option value="">Select a service type</option>
                  {serviceTypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Labor Charge <span className={requiredMark}>*</span>
                </label>
                <input
                  type="number"
                  value={svcLaborCharge}
                  onChange={(e) => setSvcLaborCharge(e.target.value)}
                  className={`${inputBase} mt-1`}
                />
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Est. Time (Mins)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={svcEstTime}
                  onChange={(e) => setSvcEstTime(e.target.value)}
                  className={`${inputBase} mt-1`}
                />
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Performed By</label>
              <select value={svcPerformedBy} onChange={(e) => setSvcPerformedBy(e.target.value)} className={`${inputBase} mt-1`}>
                <option value="">Unassigned</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>Description</label>
              <textarea
                placeholder="Service notes or findings..."
                value={svcDescription}
                onChange={(e) => setSvcDescription(e.target.value)}
                rows={2}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowAddService(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSaveService} disabled={svcSaving} className={btnPrimary}>
                {svcSaving ? "Saving..." : "Save Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPart && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>Add Part to Job Card</h2>
              <button onClick={() => setShowAddPart(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>
                Product <span className={requiredMark}>*</span>
              </label>
              <input
                placeholder="Search by SKU or Name..."
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className={`${inputBase} mt-1`}
              />
              <select
                value={partProductId}
                onChange={(e) => {
                  setPartProductId(e.target.value);
                  const p = products.find((pr) => pr.id === e.target.value);
                  if (p) setPartUnitPrice(String(p.sell_price));
                }}
                size={Math.min(6, Math.max(3, filteredProducts.length))}
                className={`${inputBase} mt-2`}
              >
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `${p.sku} — ` : ""}
                    {p.name} (stock: {p.qty_on_hand})
                  </option>
                ))}
                {filteredProducts.length === 0 && <option disabled>No matching products</option>}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Quantity <span className={requiredMark}>*</span>
                </label>
                <input
                  type="number"
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  className={`${inputBase} mt-1`}
                />
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Unit Price (Charge) <span className={requiredMark}>*</span>
                </label>
                <input
                  type="number"
                  value={partUnitPrice}
                  onChange={(e) => setPartUnitPrice(e.target.value)}
                  className={`${inputBase} mt-1`}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowAddPart(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSavePart} disabled={partSaving} className={btnPrimary}>
                {partSaving ? "Saving..." : "Save Part"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuote && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>Quote — {jobCard.job_no}</h2>
              <button onClick={() => setShowQuote(false)} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">
                ×
              </button>
            </div>
            <p className="text-sm text-muted">
              {jobCard.customers?.name} · {jobCard.vehicles?.vehicle_number}
            </p>
            <div className="space-y-2 text-sm">
              {services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-ink">{s.service_types?.name ?? s.custom_service_name}</span>
                  <span className="text-ink">LKR {s.labor_charge.toFixed(2)}</span>
                </div>
              ))}
              {parts.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="text-ink">
                    {p.parts?.name} × {p.qty}
                  </span>
                  <span className="text-ink">LKR {p.line_total.toFixed(2)}</span>
                </div>
              ))}
              {services.length === 0 && parts.length === 0 && <p className="text-muted">No services or parts added yet.</p>}
            </div>
            <hr className="border-card" />
            <div className="flex justify-between text-base font-bold">
              <span className="text-ink">Estimated Total</span>
              <span className="text-accent">LKR {jobCard.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowQuote(false)} className={btnSecondary}>
                Close
              </button>
              <button onClick={() => window.print()} className={btnPrimary}>
                Print Quote
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
              <button onClick={() => setConfirmDialog(null)} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-error text-white text-sm font-semibold hover:bg-error-hover disabled:opacity-60"
              >
                {busy ? "Working..." : "Confirm"}
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
