"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Staff = { id: string; full_name: string; role: "admin" | "cashier"; phone: string | null; is_active: boolean };

export default function UsersClient({ initialStaff }: { initialStaff: Staff[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "cashier" as "admin" | "cashier" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleInvite() {
    setError(null);
    if (!form.email || !form.fullName) {
      setError("Email and name are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/staff/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not invite staff member.");
      return;
    }
    setShowForm(false);
    setForm({ email: "", fullName: "", role: "cashier" });
    router.refresh();
  }

  async function toggleActive(s: Staff) {
    await supabase.from("profiles").update({ is_active: !s.is_active }).eq("id", s.id);
    router.refresh();
  }

  async function changeRole(s: Staff, role: "admin" | "cashier") {
    await supabase.from("profiles").update({ role }).eq("id", s.id);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
        >
          + Invite Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialStaff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-slate-800">{s.full_name}</td>
                <td className="px-4 py-2">
                  <select
                    value={s.role}
                    onChange={(e) => changeRole(s, e.target.value as "admin" | "cashier")}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span className={s.is_active ? "text-green-600" : "text-slate-400"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggleActive(s)}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Invite Staff Member</h2>
            <p className="text-sm text-slate-500">
              They&apos;ll get an email invite to set up their own password.
            </p>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "cashier" })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
