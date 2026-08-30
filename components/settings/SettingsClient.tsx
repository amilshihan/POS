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
};

export default function SettingsClient({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    shop_name: settings?.shop_name ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    receipt_width_mm: String(settings?.receipt_width_mm ?? 80),
    cheque_alert_days: String(settings?.cheque_alert_days ?? 7),
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
      })
      .eq("id", true);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="p-6 max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
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
