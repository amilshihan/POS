"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CATEGORIES, serviceCategoryLabel } from "@/lib/workshop";
import {
  modalTitle,
  fieldLabel,
  helperText,
  requiredMark,
  inputBase,
  btnPrimary,
  btnSecondary,
  iconActionBtn,
  iconActionBtnDanger,
  cardSurface,
} from "@/lib/ui";

type ServiceType = {
  id: string;
  name: string;
  category: string | null;
  default_labor_charge: number;
  estimated_time_mins: number | null;
  description: string | null;
  is_active: boolean;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "",
  default_labor_charge: "0",
  estimated_time_mins: "",
  description: "",
  is_active: true,
};

function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
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

export default function ServiceTypesClient({ initialServiceTypes }: { initialServiceTypes: ServiceType[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = initialServiceTypes.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s: ServiceType) {
    setForm({
      id: s.id,
      name: s.name,
      category: s.category ?? "",
      default_labor_charge: String(s.default_labor_charge),
      estimated_time_mins: s.estimated_time_mins ? String(s.estimated_time_mins) : "",
      description: s.description ?? "",
      is_active: s.is_active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setAlertMessage("Please enter a service name.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category || null,
      default_labor_charge: Number(form.default_labor_charge) || 0,
      estimated_time_mins: form.estimated_time_mins ? Number(form.estimated_time_mins) : null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("service_types").update(payload).eq("id", form.id)
      : await supabase.from("service_types").insert(payload);
    setSaving(false);
    if (error) {
      setAlertMessage(error.message);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  function handleDelete(s: ServiceType) {
    setConfirmDialog({
      message: `Delete "${s.name}"? This can't be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        const { error } = await supabase.from("service_types").delete().eq("id", s.id);
        setDeleting(false);
        if (error) {
          setAlertMessage(
            error.code === "23503"
              ? `Can't delete "${s.name}" — it's used on existing job cards.`
              : error.message
          );
        }
        router.refresh();
      },
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Workshop Services</h1>
          <p className="text-sm text-muted">{initialServiceTypes.length} records</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>
          <IconPlus className="w-4 h-4" />
          Add Service Type
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name..."
        className={`${inputBase} max-w-sm`}
      />

      <div className={`${cardSurface} overflow-hidden overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Service Name</th>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-left px-4 py-2 font-medium">Est. Time</th>
              <th className="text-right px-4 py-2 font-medium">Labor Charge</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card">
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-ink font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted">{serviceCategoryLabel(s.category)}</td>
                <td className="px-4 py-2 text-muted">{s.estimated_time_mins ? `${s.estimated_time_mins} mins` : "—"}</td>
                <td className="px-4 py-2 text-right text-ink">LKR {s.default_labor_charge.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      s.is_active ? "bg-accent text-white" : "bg-surface text-muted"
                    }`}
                  >
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(s)} title="Edit" aria-label="Edit" className={iconActionBtn}>
                      <IconPencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
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
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No service types found.
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
              <h2 className={modalTitle}>{form.id ? "Edit Service Type" : "Add Service Type"}</h2>
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
                Service Name <span className={requiredMark}>*</span>
              </label>
              <input
                placeholder="e.g. Full Engine Service"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`${inputBase} mt-1`}
              />
            </div>

            <div>
              <label className={fieldLabel}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={`${inputBase} mt-1`}
              >
                <option value="">Select category...</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>
                  Default Labor Charge <span className={requiredMark}>*</span>
                </label>
                <input
                  type="number"
                  value={form.default_labor_charge}
                  onChange={(e) => setForm({ ...form, default_labor_charge: e.target.value })}
                  className={`${inputBase} mt-1`}
                />
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Estimated Time (Mins)</label>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={form.estimated_time_mins}
                  onChange={(e) => setForm({ ...form, estimated_time_mins: e.target.value })}
                  className={`${inputBase} mt-1`}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Description</label>
              <textarea
                placeholder="Detailed description of what the service includes..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={`${inputBase} mt-1`}
              />
            </div>

            <div className="flex items-center justify-between border border-card rounded-xl p-4">
              <div>
                <p className="text-base font-semibold text-ink">Active Status</p>
                <p className={helperText}>Inactive services will be hidden from the workshop assignment dropdown.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  form.is_active ? "bg-accent" : "bg-card"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className={btnPrimary}>
                {saving ? "Saving..." : "Save Service"}
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
