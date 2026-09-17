"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { modalTitle, fieldLabel, helperText, requiredMark, inputBase, btnPrimary, btnSecondary, cardSurface } from "@/lib/ui";

type Brand = { id: string; name: string; is_active: boolean };
type Model = { id: string; brand_id: string; name: string; is_active: boolean; vehicle_brands: { name: string } | null };

function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-accent text-white" : "bg-surface text-muted"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ActiveToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border border-card rounded-xl p-4">
      <div>
        <p className="text-base font-semibold text-ink">Active</p>
        <p className={helperText}>{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-accent" : "bg-card"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function VehicleMasterDataClient({
  initialBrands,
  initialModels,
}: {
  initialBrands: Brand[];
  initialModels: Model[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [brandSearch, setBrandSearch] = useState("");
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState({ id: "", name: "", is_active: true });
  const [brandSaving, setBrandSaving] = useState(false);

  const [modelSearch, setModelSearch] = useState("");
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState({ id: "", name: "", brand_id: "", is_active: true });
  const [modelSaving, setModelSaving] = useState(false);

  const filteredBrands = initialBrands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  const filteredModels = initialModels.filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()));

  function openNewBrand() {
    setBrandForm({ id: "", name: "", is_active: true });
    setShowBrandForm(true);
  }
  function openEditBrand(b: Brand) {
    setBrandForm({ id: b.id, name: b.name, is_active: b.is_active });
    setShowBrandForm(true);
  }
  async function handleSaveBrand() {
    if (!brandForm.name.trim()) {
      setAlertMessage("Please enter a brand name.");
      return;
    }
    setBrandSaving(true);
    const payload = { name: brandForm.name.trim(), is_active: brandForm.is_active };
    const { error } = brandForm.id
      ? await supabase.from("vehicle_brands").update(payload).eq("id", brandForm.id)
      : await supabase.from("vehicle_brands").insert(payload);
    setBrandSaving(false);
    if (error) {
      setAlertMessage(error.code === "23505" ? "This brand already exists." : error.message);
      return;
    }
    setShowBrandForm(false);
    router.refresh();
  }

  function openNewModel() {
    setModelForm({ id: "", name: "", brand_id: "", is_active: true });
    setShowModelForm(true);
  }
  function openEditModel(m: Model) {
    setModelForm({ id: m.id, name: m.name, brand_id: m.brand_id, is_active: m.is_active });
    setShowModelForm(true);
  }
  async function handleSaveModel() {
    if (!modelForm.name.trim()) {
      setAlertMessage("Please enter a model name.");
      return;
    }
    if (!modelForm.brand_id) {
      setAlertMessage("Please select a brand.");
      return;
    }
    setModelSaving(true);
    const payload = { name: modelForm.name.trim(), brand_id: modelForm.brand_id, is_active: modelForm.is_active };
    const { error } = modelForm.id
      ? await supabase.from("vehicle_models").update(payload).eq("id", modelForm.id)
      : await supabase.from("vehicle_models").insert(payload);
    setModelSaving(false);
    if (error) {
      setAlertMessage(error.code === "23505" ? "This model already exists for the selected brand." : error.message);
      return;
    }
    setShowModelForm(false);
    router.refresh();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Vehicle Master Data</h1>
        <p className="text-sm text-muted">Manage master data. Keep names consistent to improve search and reporting.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardSurface} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Brands</h2>
              <p className={helperText}>{initialBrands.length} records</p>
            </div>
            <button onClick={openNewBrand} className={btnPrimary}>
              <IconPlus className="w-4 h-4" />
              Add Brand
            </button>
          </div>
          <div className="relative">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search brands..."
              className={`${inputBase} pl-10`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Brand Name</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card">
                {filteredBrands.map((b) => (
                  <tr key={b.id} onClick={() => openEditBrand(b)} className="cursor-pointer hover:bg-surface">
                    <td className="px-3 py-2 text-ink font-medium">{b.name}</td>
                    <td className="px-3 py-2">
                      <StatusBadge active={b.is_active} />
                    </td>
                  </tr>
                ))}
                {filteredBrands.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-muted">
                      No brands found.
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
              <h2 className="text-lg font-semibold text-ink">Models</h2>
              <p className={helperText}>{initialModels.length} records</p>
            </div>
            <button onClick={openNewModel} className={btnPrimary}>
              <IconPlus className="w-4 h-4" />
              Add Model
            </button>
          </div>
          <div className="relative">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              placeholder="Search models..."
              className={`${inputBase} pl-10`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Model Name</th>
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card">
                {filteredModels.map((m) => (
                  <tr key={m.id} onClick={() => openEditModel(m)} className="cursor-pointer hover:bg-surface">
                    <td className="px-3 py-2 text-ink font-medium">{m.name}</td>
                    <td className="px-3 py-2 text-muted">{m.vehicle_brands?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge active={m.is_active} />
                    </td>
                  </tr>
                ))}
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted">
                      No models found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBrandForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>{brandForm.id ? "Edit Brand" : "Add Brand"}</h2>
              <button
                onClick={() => setShowBrandForm(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>
                Brand Name <span className={requiredMark}>*</span>
              </label>
              <input
                placeholder="Enter brand name"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                className={`${inputBase} mt-1`}
              />
            </div>
            <ActiveToggle
              label="Inactive brands can be hidden in workshop."
              value={brandForm.is_active}
              onChange={(v) => setBrandForm({ ...brandForm, is_active: v })}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowBrandForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSaveBrand} disabled={brandSaving} className={btnPrimary}>
                {brandSaving ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModelForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between">
              <h2 className={modalTitle}>{modelForm.id ? "Edit Model" : "Add Model"}</h2>
              <button
                onClick={() => setShowModelForm(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div>
              <label className={fieldLabel}>
                Model Name <span className={requiredMark}>*</span>
              </label>
              <input
                placeholder="Enter model name"
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                className={`${inputBase} mt-1`}
              />
            </div>
            <div>
              <label className={fieldLabel}>
                Brand <span className={requiredMark}>*</span>
              </label>
              <select
                value={modelForm.brand_id}
                onChange={(e) => setModelForm({ ...modelForm, brand_id: e.target.value })}
                className={`${inputBase} mt-1`}
              >
                <option value="">Select brand</option>
                {initialBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <ActiveToggle
              label="Inactive models can be hidden in workshop."
              value={modelForm.is_active}
              onChange={(v) => setModelForm({ ...modelForm, is_active: v })}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowModelForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSaveModel} disabled={modelSaving} className={btnPrimary}>
                {modelSaving ? "Saving..." : "Save Model"}
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
