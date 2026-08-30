"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PartRow = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  sell_price: number;
  qty_on_hand: number;
  unit: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  credit_balance: number;
};

type CartLine = { part: PartRow; qty: number };

type PaymentMethod = "cash" | "credit" | "cheque" | "mixed";

export default function POSClient({
  initialParts,
  customers,
  cashierId,
}: {
  initialParts: PartRow[];
  customers: CustomerRow[];
  cashierId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [scanBuffer, setScanBuffer] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.qty * l.part.sell_price, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - discount);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return initialParts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, initialParts]);

  function addPart(part: PartRow) {
    setCart((prev) => {
      const existing = prev.find((l) => l.part.id === part.id);
      if (existing) {
        return prev.map((l) => (l.part.id === part.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { part, qty: 1 }];
    });
    setSearch("");
  }

  function updateQty(partId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.part.id === partId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function removeLine(partId: string) {
    setCart((prev) => prev.filter((l) => l.part.id !== partId));
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanBuffer.trim();
    setScanBuffer("");
    if (!code) return;
    const match = initialParts.find((p) => p.barcode === code || p.sku === code);
    if (match) {
      addPart(match);
      setError(null);
    } else {
      setError(`No part found for code "${code}"`);
    }
  }

  async function handleCheckout() {
    setError(null);

    if (cart.length === 0) {
      setError("Add at least one part to the cart.");
      return;
    }
    if ((paymentMethod === "credit" || paymentMethod === "mixed") && !customerId) {
      setError("Select a customer for credit or mixed payment.");
      return;
    }
    if (paymentMethod === "cheque" && (!chequeNumber || !chequeDueDate)) {
      setError("Enter the cheque number and due date.");
      return;
    }

    let paid = total;
    if (paymentMethod === "credit" || paymentMethod === "mixed") {
      paid = Number(amountPaid || 0);
      if (paid < 0 || paid > total) {
        setError("Amount paid must be between 0 and the total.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: customerId || null,
          cashier_id: cashierId,
          subtotal,
          discount,
          tax: 0,
          total,
          amount_paid: paid,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (saleError || !sale) throw saleError ?? new Error("Could not create sale");

      const { error: itemsError } = await supabase.from("sale_items").insert(
        cart.map((l) => ({
          sale_id: sale.id,
          part_id: l.part.id,
          qty: l.qty,
          unit_price: l.part.sell_price,
          line_total: l.qty * l.part.sell_price,
        }))
      );
      if (itemsError) throw itemsError;

      if (paymentMethod === "cheque") {
        const { error: chequeError } = await supabase.from("cheques").insert({
          direction: "received",
          related_sale_id: sale.id,
          customer_id: customerId || null,
          cheque_number: chequeNumber,
          bank_name: bankName || null,
          amount: total,
          due_date: chequeDueDate,
          created_by: cashierId,
        });
        if (chequeError) throw chequeError;
      }

      router.push(`/sales/${sale.id}/receipt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">New Sale</h1>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Scan barcode (or click here, then scan)
          </label>
          <input
            ref={scanInputRef}
            value={scanBuffer}
            onChange={(e) => setScanBuffer(e.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="Scan a part's barcode..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          <label className="block text-sm font-medium text-slate-700 pt-2">
            Or search by name / SKU
          </label>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a part name..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filteredParts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {filteredParts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPart(p)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between text-sm border-b border-slate-100 last:border-0"
                  >
                    <span>
                      {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                    </span>
                    <span className="text-slate-500">
                      ${p.sell_price.toFixed(2)} · {p.qty_on_hand} in stock
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Part</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-center px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Line Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Cart is empty — scan or search for a part above.
                  </td>
                </tr>
              ) : (
                cart.map((l) => (
                  <tr key={l.part.id}>
                    <td className="px-4 py-2 text-slate-800">{l.part.name}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      ${l.part.sell_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => updateQty(l.part.id, Number(e.target.value))}
                        className="w-16 text-center rounded border border-slate-300 py-1"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      ${(l.qty * l.part.sell_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeLine(l.part.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-800">Payment</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.credit_balance > 0 ? `(owes $${c.credit_balance.toFixed(2)})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount</label>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="cash">Cash (paid in full)</option>
              <option value="credit">Credit (customer owes)</option>
              <option value="cheque">Cheque</option>
              <option value="mixed">Mixed (partial cash + credit)</option>
            </select>
          </div>

          {(paymentMethod === "credit" || paymentMethod === "mixed") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount paid now
              </label>
              <input
                type="number"
                min={0}
                max={total}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="text-xs text-slate-400 mt-1">
                Remaining ${Math.max(0, total - Number(amountPaid || 0)).toFixed(2)} will be added
                to the customer&apos;s balance.
              </p>
            </div>
          )}

          {paymentMethod === "cheque" && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cheque number
                </label>
                <input
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bank</label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
                <input
                  type="date"
                  value={chequeDueDate}
                  onChange={(e) => setChequeDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 space-y-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Discount</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

          <button
            onClick={handleCheckout}
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {submitting ? "Processing..." : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
