"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Settings = {
  shop_name: string;
  address: string | null;
  phone: string | null;
  receipt_width_mm: number;
  low_stock_default_threshold: number;
  cheque_alert_days: number;
  printer_name: string | null;
  receipt_footer: string | null;
};

// Suggestions only — a web page can't see a device's installed printers.
// The browser's own print dialog (triggered by window.print()) is where the
// printer actually gets picked; this is just a label so staff know which
// physical printer to choose there.
const PRINTER_SUGGESTIONS = ["XP-80C", "Microsoft Print to PDF"];

const TABS = [
  { id: "general", label: "General" },
  { id: "print", label: "Print" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function SettingsClient({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState({
    shop_name: settings?.shop_name ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    receipt_width_mm: String(settings?.receipt_width_mm ?? 80),
    cheque_alert_days: String(settings?.cheque_alert_days ?? 7),
    printer_name: settings?.printer_name ?? "",
    receipt_footer: settings?.receipt_footer ?? "Thank you!",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await supabase
      .from("shop_settings")
      .update({
        shop_name: form.shop_name,
        address: form.address || null,
        phone: form.phone || null,
        receipt_width_mm: Number(form.receipt_width_mm),
        cheque_alert_days: Number(form.cheque_alert_days),
        printer_name: form.printer_name || null,
        receipt_footer: form.receipt_footer.slice(0, 512) || "Thank you!",
      })
      .eq("id", true);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="p-6 max-w-lg space-y-4">
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
          </>
        )}

        {tab === "print" && (
          <>
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

        {saved && <div className="text-sm text-green-600">Saved.</div>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white font-medium px-5 py-2.5 hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
