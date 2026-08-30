"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Supplier = { id: string; name: string; phone: string | null; address: string | null; notes: string | null };

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setForm({ name: "", phone: "", address: "", notes: "" });
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
        <div className="flex gap-2">
          <Link
            href="/purchases/new"
            className="rounded-lg bg-slate-800 text-white font-medium px-4 py-2 hover:bg-slate-900 transition"
          >
            + New Purchase
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
          >
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialSuppliers.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-slate-800">{s.name}</td>
                <td className="px-4 py-2 text-slate-500">{s.phone}</td>
                <td className="px-4 py-2 text-slate-500">{s.address}</td>
                <td className="px-4 py-2 text-slate-500">{s.notes}</td>
              </tr>
            ))}
            {initialSuppliers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Add Supplier</h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
}
