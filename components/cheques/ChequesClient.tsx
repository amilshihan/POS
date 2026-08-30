"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cheque = {
  id: string;
  direction: "received" | "issued";
  cheque_number: string;
  bank_name: string | null;
  amount: number;
  due_date: string;
  status: "pending" | "cleared" | "bounced";
  customers: { name: string } | null;
  suppliers: { name: string } | null;
};

type Option = { id: string; name: string };

const emptyForm = {
  direction: "received" as "received" | "issued",
  partyId: "",
  cheque_number: "",
  bank_name: "",
  amount: "",
  due_date: "",
};

export default function ChequesClient({
  initialCheques,
  customers,
  suppliers,
  createdBy,
}: {
  initialCheques: Cheque[];
  customers: Option[];
  suppliers: Option[];
  createdBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState<"all" | "pending" | "cleared" | "bounced">("pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = initialCheques.filter((c) => filter === "all" || c.status === filter);

  async function updateStatus(id: string, status: "cleared" | "bounced") {
    const { error } = await supabase
      .from("cheques")
      .update({ status, cleared_date: status === "cleared" ? today : null })
      .eq("id", id);
    if (!error) router.refresh();
  }

  async function handleSave() {
    setError(null);
    if (!form.cheque_number || !form.amount || !form.due_date) {
      setError("Cheque number, amount, and due date are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cheques").insert({
      direction: form.direction,
      customer_id: form.direction === "received" ? form.partyId || null : null,
      supplier_id: form.direction === "issued" ? form.partyId || null : null,
      cheque_number: form.cheque_number,
      bank_name: form.bank_name || null,
      amount: Number(form.amount),
      due_date: form.due_date,
      created_by: createdBy,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setForm(emptyForm);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Cheques</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
        >
          + Add Cheque
        </button>
      </div>

      <div className="flex gap-2">
        {(["pending", "cleared", "bounced", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              filter === f ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">#</th>
              <th className="text-left px-4 py-2 font-medium">Direction</th>
              <th className="text-left px-4 py-2 font-medium">Party</th>
              <th className="text-left px-4 py-2 font-medium">Bank</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">Due Date</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const overdue = c.status === "pending" && c.due_date < today;
              return (
                <tr key={c.id} className={overdue ? "bg-red-50" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{c.cheque_number}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">
                    {c.direction === "received" ? "From customer" : "To supplier"}
                  </td>
                  <td className="px-4 py-2 text-slate-800">
                    {c.customers?.name ?? c.suppliers?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{c.bank_name}</td>
                  <td className="px-4 py-2 text-right font-medium">${c.amount.toFixed(2)}</td>
                  <td className={`px-4 py-2 ${overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
                    {c.due_date}
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">{c.status}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {c.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(c.id, "cleared")}
                          className="text-green-600 hover:underline text-xs font-medium"
                        >
                          Mark cleared
                        </button>
                        <button
                          onClick={() => updateStatus(c.id, "bounced")}
                          className="text-red-600 hover:underline text-xs font-medium"
                        >
                          Mark bounced
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No cheques found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Add Cheque</h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <select
              value={form.direction}
              onChange={(e) =>
                setForm({ ...form, direction: e.target.value as "received" | "issued", partyId: "" })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="received">Received from customer</option>
              <option value="issued">Issued to supplier</option>
            </select>
            <select
              value={form.partyId}
              onChange={(e) => setForm({ ...form, partyId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">
                {form.direction === "received" ? "Select customer (optional)" : "Select supplier (optional)"}
              </option>
              {(form.direction === "received" ? customers : suppliers).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Cheque number"
              value={form.cheque_number}
              onChange={(e) => setForm({ ...form, cheque_number: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Bank"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
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
    </div>
  );
}
