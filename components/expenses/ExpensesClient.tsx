"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";
import Pagination, { paginate } from "@/components/ui/Pagination";

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string;
  profiles: { full_name: string } | null;
};

const CATEGORY_OPTIONS = ["Bill Payment", "Charity", "Food", "Rent", "Transport", "Other"];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesClient({
  initialExpenses,
  admin,
  createdBy,
}: {
  initialExpenses: Expense[];
  admin: boolean;
  createdBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrencySymbol();

  const [showForm, setShowForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(todayDate());
  const [category, setCategory] = useState("Bill Payment");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { totalPages, currentPage, paginated } = paginate(initialExpenses, page);

  const todayTotal = useMemo(
    () => initialExpenses.filter((e) => e.expense_date === todayDate()).reduce((s, e) => s + Number(e.amount), 0),
    [initialExpenses]
  );
  const monthTotal = useMemo(() => {
    const ym = todayDate().slice(0, 7);
    return initialExpenses
      .filter((e) => e.expense_date.slice(0, 7) === ym)
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [initialExpenses]);

  function openCreate() {
    setExpenseDate(todayDate());
    setCategory("Bill Payment");
    setCustomCategory("");
    setDescription("");
    setAmount("");
    setPaymentMethod("cash");
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setError(null);
    const finalCategory = category === "Other" ? customCategory.trim() : category;
    if (!finalCategory) {
      setError("Enter a category.");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("expenses").insert({
      expense_date: expenseDate,
      category: finalCategory,
      description: description.trim() || null,
      amount: amountNum,
      payment_method: paymentMethod,
      created_by: createdBy,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm(`Delete this ${expense.category} expense of ${currency}${Number(expense.amount).toFixed(2)}?`)) return;
    setDeletingId(expense.id);
    await supabase.from("expenses").delete().eq("id", expense.id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        {admin && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-700"
          >
            + Add Expense
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Today</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currency}
            {todayTotal.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">This Month</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {currency}
            {monthTotal.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-left px-4 py-2 font-medium">Paid Via</th>
              <th className="text-left px-4 py-2 font-medium">Recorded By</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              {admin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={admin ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                  No expenses recorded yet.
                </td>
              </tr>
            ) : (
              paginated.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-slate-700">{new Date(e.expense_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-slate-800 font-medium">{e.category}</td>
                  <td className="px-4 py-2 text-slate-500">{e.description ?? "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.payment_method === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {e.payment_method === "cash" ? "Cash" : "Online Transfer"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{e.profiles?.full_name ?? "-"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">
                    {currency}
                    {Number(e.amount).toFixed(2)}
                  </td>
                  {admin && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDelete(e)}
                        disabled={deletingId === e.id}
                        className="text-red-500 hover:underline text-xs font-medium disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={initialExpenses.length}
          shownCount={paginated.length}
          onPageChange={setPage}
          itemLabel="expenses"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Add Expense</h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

            <div>
              <label className="text-xs text-slate-500">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {category === "Other" && (
              <input
                placeholder="Describe the category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            )}

            <div>
              <label className="text-xs text-slate-500">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Paid via</label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    paymentMethod === "cash" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("online")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    paymentMethod === "online" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  Online Transfer
                </button>
              </div>
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
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
