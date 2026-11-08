"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, DEFAULT_CURRENCY_CODE } from "@/lib/currency";

type Settings = {
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receipt_width_mm: number;
  low_stock_default_threshold: number;
  cheque_alert_days: number;
  printer_name: string | null;
  receipt_footer: string | null;
  auto_open_drawer_on_print: boolean;
  logo_url: string | null;
  logo_print_enabled: boolean;
  currency: string;
};

// Suggestions only — a web page can't see a device's installed printers.
// The browser's own print dialog (triggered by window.print()) is where the
// printer actually gets picked; this is just a label so staff know which
// physical printer to choose there.
const PRINTER_SUGGESTIONS = ["XP-80C", "Microsoft Print to PDF"];

type PaymentType = {
  id: string;
  name: string;
  kind: "cash" | "card" | "online";
  commission_percent: number;
  is_active: boolean;
  sort_order: number;
};

const TABS = [
  { id: "general", label: "General" },
  { id: "print", label: "Print" },
  { id: "payments", label: "Payments" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function SettingsClient({
  settings,
  initialPaymentTypes,
}: {
  settings: Settings | null;
  initialPaymentTypes: PaymentType[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("general");
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>(initialPaymentTypes);
  const [ptName, setPtName] = useState("");
  const [ptKind, setPtKind] = useState<"cash" | "card" | "online">("card");
  const [ptCommission, setPtCommission] = useState("0");
  const [ptError, setPtError] = useState<string | null>(null);
  const [ptSaving, setPtSaving] = useState(false);
  const [editingPtId, setEditingPtId] = useState<string | null>(null);
  const [form, setForm] = useState({
    shop_name: settings?.shop_name ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    receipt_width_mm: String(settings?.receipt_width_mm ?? 80),
    cheque_alert_days: String(settings?.cheque_alert_days ?? 7),
    printer_name: settings?.printer_name ?? "",
    receipt_footer: settings?.receipt_footer ?? "Thank you!",
    auto_open_drawer_on_print: settings?.auto_open_drawer_on_print ?? false,
    logo_url: settings?.logo_url ?? "",
    logo_print_enabled: settings?.logo_print_enabled ?? true,
    currency: settings?.currency ?? DEFAULT_CURRENCY_CODE,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image must be smaller than 2MB.");
      return;
    }
    setLogoError(null);
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-assets")
        .upload(path, file, { cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("shop-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Could not upload the logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function resetPtForm() {
    setEditingPtId(null);
    setPtName("");
    setPtKind("card");
    setPtCommission("0");
    setPtError(null);
  }

  function openEditPt(pt: PaymentType) {
    setEditingPtId(pt.id);
    setPtName(pt.name);
    setPtKind(pt.kind);
    setPtCommission(String(pt.commission_percent));
    setPtError(null);
  }

  async function handleSavePaymentType() {
    setPtError(null);
    if (!ptName.trim()) {
      setPtError("Enter a name for this payment type.");
      return;
    }
    const commissionNum = Number(ptCommission);
    if (commissionNum < 0 || commissionNum > 100 || Number.isNaN(commissionNum)) {
      setPtError("Commission must be a number between 0 and 100.");
      return;
    }
    setPtSaving(true);
    if (editingPtId) {
      const { data, error } = await supabase
        .from("payment_types")
        .update({ name: ptName.trim(), kind: ptKind, commission_percent: commissionNum })
        .eq("id", editingPtId)
        .select()
        .single();
      setPtSaving(false);
      if (error || !data) {
        setPtError(error?.message ?? "Could not save.");
        return;
      }
      setPaymentTypes((prev) => prev.map((pt) => (pt.id === editingPtId ? data : pt)));
    } else {
      const { data, error } = await supabase
        .from("payment_types")
        .insert({
          name: ptName.trim(),
          kind: ptKind,
          commission_percent: commissionNum,
          sort_order: paymentTypes.length,
        })
        .select()
        .single();
      setPtSaving(false);
      if (error || !data) {
        setPtError(error?.message ?? "Could not save.");
        return;
      }
      setPaymentTypes((prev) => [...prev, data]);
    }
    resetPtForm();
    router.refresh();
  }

  async function handleTogglePtActive(pt: PaymentType) {
    const { error } = await supabase.from("payment_types").update({ is_active: !pt.is_active }).eq("id", pt.id);
    if (!error) {
      setPaymentTypes((prev) => prev.map((p) => (p.id === pt.id ? { ...p, is_active: !p.is_active } : p)));
      router.refresh();
    }
  }

  async function handleDeletePt(pt: PaymentType) {
    if (!window.confirm(`Delete payment type "${pt.name}"?`)) return;
    const { error } = await supabase.from("payment_types").delete().eq("id", pt.id);
    if (!error) {
      setPaymentTypes((prev) => prev.filter((p) => p.id !== pt.id));
      router.refresh();
    } else {
      setPtError(error.message);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await supabase
      .from("shop_settings")
      .update({
        shop_name: form.shop_name,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        receipt_width_mm: Number(form.receipt_width_mm),
        cheque_alert_days: Number(form.cheque_alert_days),
        printer_name: form.printer_name || null,
        receipt_footer: form.receipt_footer.slice(0, 512) || "Thank you!",
        auto_open_drawer_on_print: form.auto_open_drawer_on_print,
        logo_url: form.logo_url || null,
        logo_print_enabled: form.logo_print_enabled,
        currency: form.currency,
      })
      .eq("id", true);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {tab === "general" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shop name</label>
              <input
                value={form.shop_name}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="shop@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-400">Shown on social media promo images alongside the phone number.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Warn about cheques due within (days)
              </label>
              <input
                type="number"
                value={form.cheque_alert_days}
                onChange={(e) => setForm({ ...form, cheque_alert_days: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Used everywhere an amount is shown across the app and on receipts.
              </p>
            </div>
          </>
        )}

        {tab === "print" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shop logo</label>
              {form.logo_url && (
                <div className="mb-2 flex items-center gap-3">
                  <img
                    src={form.logo_url}
                    alt="Shop logo"
                    className="h-16 w-auto object-contain rounded border border-slate-200 bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
              />
              {uploadingLogo && <p className="mt-1 text-xs text-slate-400">Uploading...</p>}
              {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
              <p className="mt-1 text-xs text-slate-400">
                A PNG with a transparent background works best.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                id="logo-print-enabled"
                checked={form.logo_print_enabled}
                onChange={(e) => setForm({ ...form, logo_print_enabled: e.target.checked })}
                disabled={!form.logo_url}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 disabled:opacity-50"
              />
              <label htmlFor="logo-print-enabled" className="text-sm">
                <span className="block font-medium text-slate-700">Print logo on receipt</span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {form.logo_url
                    ? "When off, the logo stays uploaded but won't appear on printed bills."
                    : "Upload a logo above to enable this."}
                </span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Receipt printer width
              </label>
              <select
                value={form.receipt_width_mm}
                onChange={(e) => setForm({ ...form, receipt_width_mm: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="80">80mm</option>
                <option value="58">58mm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Printer</label>
              <input
                list="printer-suggestions"
                value={form.printer_name}
                onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
                placeholder="e.g. XP-80C"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <datalist id="printer-suggestions">
                {PRINTER_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-slate-400">
                Reminder of which printer to pick when the receipt print dialog opens — browsers
                don&apos;t allow a page to select a printer automatically.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                id="auto-open-drawer"
                checked={form.auto_open_drawer_on_print}
                onChange={(e) => setForm({ ...form, auto_open_drawer_on_print: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="auto-open-drawer" className="text-sm">
                <span className="block font-medium text-slate-700">
                  Automatic drawer open once the bill prints
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  Opens the cash drawer right after a sale receipt finishes printing. Requires the
                  printer above to be set correctly.
                </span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt footer</label>
              <textarea
                value={form.receipt_footer}
                onChange={(e) => setForm({ ...form, receipt_footer: e.target.value.slice(0, 512) })}
                maxLength={512}
                rows={3}
                placeholder="Thank you!"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-slate-400 text-right">
                {form.receipt_footer.length}/512
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <a
                href="/sales/sample/receipt"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 text-slate-700 font-medium px-4 py-2 text-sm hover:bg-slate-50"
              >
                Print Preview
              </a>
              <a
                href="/sales/sample/receipt?print=1"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 text-slate-700 font-medium px-4 py-2 text-sm hover:bg-slate-50"
              >
                Print Sample Bill
              </a>
            </div>
          </>
        )}

        {tab === "payments" && (
          <>
            <p className="text-xs text-slate-500">
              Payment types shown at checkout and when recording a customer payment. Each type's
              commission % is captured on every sale/payment so past figures don&apos;t change if you
              edit the rate later.
            </p>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {paymentTypes.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-400 text-center">No payment types yet.</p>
              ) : (
                paymentTypes.map((pt) => (
                  <div key={pt.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">
                        {pt.name}
                        {!pt.is_active && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {pt.kind} &middot; {pt.commission_percent}% commission
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => openEditPt(pt)} className="text-blue-600 hover:underline text-xs font-medium">
                        Edit
                      </button>
                      <button
                        onClick={() => handleTogglePtActive(pt)}
                        className="text-slate-500 hover:underline text-xs font-medium"
                      >
                        {pt.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeletePt(pt)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="text-sm font-semibold text-slate-700">
                {editingPtId ? "Edit payment type" : "Add payment type"}
              </div>
              {ptError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{ptError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Name</label>
                  <input
                    value={ptName}
                    onChange={(e) => setPtName(e.target.value)}
                    placeholder="e.g. Visa Card"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Kind</label>
                  <select
                    value={ptKind}
                    onChange={(e) => setPtKind(e.target.value as "cash" | "card" | "online")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Commission %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={ptCommission}
                    onChange={(e) => setPtCommission(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSavePaymentType}
                  disabled={ptSaving}
                  className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {ptSaving ? "Saving..." : editingPtId ? "Save Changes" : "+ Add Payment Type"}
                </button>
                {editingPtId && (
                  <button
                    onClick={resetPtForm}
                    className="rounded-lg border border-slate-300 text-slate-600 font-medium px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {tab !== "payments" && (
          <>
            {saved && <div className="text-sm text-green-600">Saved.</div>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 text-white font-medium px-5 py-2.5 hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
