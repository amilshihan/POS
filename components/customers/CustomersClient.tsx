"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  credit_balance: number;
};

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", credit_limit: "0" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const filtered = initialCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      credit_limit: Number(form.credit_limit),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setForm({ name: "", phone: "", address: "", credit_limit: "0" });
    router.refresh();
  }

  async function handleRecordPayment() {
    if (!payFor) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      customer_id: payFor.id,
      amount,
      method: "cash",
      received_by: user?.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPayFor(null);
    setPayAmount("");
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
        >
          + Add Customer
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2"
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-right px-4 py-2 font-medium">Credit Limit</th>
              <th className="text-right px-4 py-2 font-medium">Balance Owed</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-slate-800">{c.name}</td>
                <td className="px-4 py-2 text-slate-500">{c.phone}</td>
                <td className="px-4 py-2 text-right text-slate-600">
                  ${c.credit_limit.toFixed(2)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    c.credit_balance > 0 ? "text-red-600" : "text-slate-800"
                  }`}
                >
                  ${c.credit_balance.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.credit_balance > 0 && (
                    <button
                      onClick={() => setPayFor(c)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Add Customer</h2>
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
            <div>
              <label className="text-xs text-slate-500">Credit limit</label>
              <input
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
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

      {payFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Record Payment — {payFor.name}</h2>
            <p className="text-sm text-slate-500">Currently owes ${payFor.credit_balance.toFixed(2)}</p>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input
              type="number"
              placeholder="Amount"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPayFor(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
