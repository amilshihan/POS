"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrencySymbol } from "@/lib/currency";
import { cardSurface, btnSecondary, inputBase } from "@/lib/ui";

type Sale = {
  id: string;
  sale_number: string;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  payment_method: string;
  status: string;
  void_reason: string | null;
  customers: { name: string; phone: string | null } | null;
  profiles: { full_name: string } | null;
};

type SaleItem = {
  id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  parts: { name: string; unit: string } | null;
};

type FilterTab = "all" | "new" | "paid" | "cancelled";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New (Unpaid)" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
];

function invoiceState(s: Sale): "cancelled" | "paid" | "new" {
  if (s.status === "voided") return "cancelled";
  if (s.amount_paid >= s.total - 0.01) return "paid";
  return "new";
}

const STATE_BADGE: Record<string, string> = {
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  new: "bg-amber-100 text-amber-700",
};

const STATE_LABEL: Record<string, string> = {
  cancelled: "Cancelled",
  paid: "Paid",
  new: "New / Unpaid",
};

export default function InvoicesClient({
  initialSales,
  currency,
  admin,
}: {
  initialSales: Sale[];
  currency: string;
  admin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const cur = getCurrencySymbol(currency);

  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<Sale | null>(null);
  const [viewItems, setViewItems] = useState<SaleItem[] | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  async function openView(s: Sale) {
    setViewTarget(s);
    setViewItems(null);
    setViewError(null);
    setViewLoading(true);
    const { data, error: fetchError } = await supabase
      .from("sale_items")
      .select("id, qty, unit_price, line_total, parts(name, unit)")
      .eq("sale_id", s.id);
    setViewLoading(false);
    if (fetchError) {
      setViewError(fetchError.message);
      return;
    }
    setViewItems((data ?? []) as unknown as SaleItem[]);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialSales.filter((s) => {
      if (tab !== "all" && invoiceState(s) !== tab) return false;
      if (!q) return true;
      return (
        s.sale_number.toLowerCase().includes(q) ||
        (s.customers?.name ?? "").toLowerCase().includes(q) ||
        (s.customers?.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialSales, tab, search]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("void_sale", {
      p_sale_id: cancelTarget.id,
      p_reason: cancelReason.trim() || null,
    });
    setCancelling(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setCancelTarget(null);
    setCancelReason("");
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-500">All sales — new, paid, and cancelled.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice #, customer name or phone..."
          className={`${inputBase} max-w-xs ml-auto`}
        />
      </div>

      <div className={`${cardSurface} overflow-hidden overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Cashier</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
              <th className="text-right px-4 py-2 font-medium">Paid</th>
              <th className="text-left px-4 py-2 font-medium">Payment</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No invoices found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const state = invoiceState(s);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{s.sale_number}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{s.customers?.name ?? "Walk-in"}</td>
                    <td className="px-4 py-2 text-slate-600">{s.profiles?.full_name ?? "-"}</td>
                    <td className="px-4 py-2 text-right text-slate-800">
                      {cur}
                      {s.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {cur}
                      {s.amount_paid.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 capitalize">{s.payment_method}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_BADGE[state]}`}
                        title={state === "cancelled" ? s.void_reason ?? undefined : undefined}
                      >
                        {STATE_LABEL[state]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => openView(s)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {cancelTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelTarget(null);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h2 className="font-semibold text-lg text-slate-900">Cancel {cancelTarget.sale_number}?</h2>
              <p className="text-sm text-slate-500 mt-1">
                This restores the stock this sale took out (and reverses any credit balance it added).
                Use this for a return/refund. This can&apos;t be undone.
              </p>
            </div>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="e.g. Customer returned item, refunded in cash"
                className={inputBase}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCancelTarget(null)} className={btnSecondary} disabled={cancelling}>
                Keep Invoice
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Cancel Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewTarget(null);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg text-slate-900">{viewTarget.sale_number}</h2>
                <p className="text-sm text-slate-500">{new Date(viewTarget.created_at).toLocaleString()}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  STATE_BADGE[invoiceState(viewTarget)]
                }`}
              >
                {STATE_LABEL[invoiceState(viewTarget)]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
              <div>
                Customer: <span className="text-slate-800">{viewTarget.customers?.name ?? "Walk-in"}</span>
              </div>
              <div>
                Cashier: <span className="text-slate-800">{viewTarget.profiles?.full_name ?? "-"}</span>
              </div>
              <div>
                Payment: <span className="text-slate-800 capitalize">{viewTarget.payment_method}</span>
              </div>
              {viewTarget.void_reason && (
                <div className="col-span-2 text-red-600">Cancelled: {viewTarget.void_reason}</div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium">Item</th>
                    <th className="text-center px-3 py-1.5 font-medium">Qty</th>
                    <th className="text-right px-3 py-1.5 font-medium">Price</th>
                    <th className="text-right px-3 py-1.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewLoading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Loading items...
                      </td>
                    </tr>
                  )}
                  {viewError && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-red-600">
                        {viewError}
                      </td>
                    </tr>
                  )}
                  {viewItems?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-1.5 text-slate-800">
                        {item.parts?.name ?? "-"}
                        {item.parts?.unit && <span className="text-slate-400"> ({item.parts.unit})</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center text-slate-600">{item.qty}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {cur}
                        {item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-800">
                        {cur}
                        {item.line_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {viewItems?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        No items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-sm border-t border-slate-200 pt-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>
                  {cur}
                  {viewTarget.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount</span>
                <span>
                  -{cur}
                  {viewTarget.discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Total</span>
                <span>
                  {cur}
                  {viewTarget.total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid</span>
                <span>
                  {cur}
                  {viewTarget.amount_paid.toFixed(2)}
                </span>
              </div>
              {viewTarget.amount_paid < viewTarget.total && (
                <div className="flex justify-between font-semibold text-amber-700">
                  <span>Balance</span>
                  <span>
                    {cur}
                    {(viewTarget.total - viewTarget.amount_paid).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {admin && invoiceState(viewTarget) !== "cancelled" ? (
                <button
                  onClick={() => {
                    setCancelTarget(viewTarget);
                    setCancelReason("");
                    setError(null);
                    setViewTarget(null);
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Cancel Invoice
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={() => setViewTarget(null)} className={btnSecondary}>
                  Close
                </button>
                <a
                  href={`/sales/${viewTarget.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                    <path d="M5.5 7.5V3.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="3" y="7.5" width="14" height="6" rx="1.2" />
                    <path d="M5.5 12.5h9v4h-9z" strokeLinejoin="round" />
                  </svg>
                  Print
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
