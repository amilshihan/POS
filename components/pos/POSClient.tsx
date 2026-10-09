"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TITLES, combineTitleName, isValidName, isValidPhone } from "@/lib/validation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, combinePhone } from "@/lib/countries";

type PartRow = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  cost_price?: number;
  sell_price: number;
  qty_on_hand: number;
  unit: string;
};

type CustomerRow = {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  credit_balance: number;
};

type CartLine = { part: PartRow; qty: number; discount: number; packageId?: string };

type PaymentMethod = "cash" | "credit" | "cheque" | "mixed";

export default function POSClient({
  initialParts,
  customers,
  cashierId,
  admin,
}: {
  initialParts: PartRow[];
  customers: CustomerRow[];
  cashierId: string;
  admin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [scanBuffer, setScanBuffer] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerTitle, setNewCustomerTitle] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhoneCountry, setNewCustomerPhoneCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [packagePrices, setPackagePrices] = useState<Record<string, number>>({});
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageSelection, setPackageSelection] = useState<Set<string>>(new Set());
  const [packagePriceInput, setPackagePriceInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  async function handleOpenDrawer() {
    setOpeningDrawer(true);
    try {
      const res = await fetch("/api/cash-drawer/open", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open the drawer.");
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : "Could not open the drawer.");
    } finally {
      setOpeningDrawer(false);
    }
  }

  function lineEffectiveUnitPrice(l: CartLine): number {
    if (l.packageId) {
      const group = cart.filter((x) => x.packageId === l.packageId);
      const groupNormalTotal = group.reduce((s, x) => s + x.qty * x.part.sell_price, 0);
      const packageTotal = packagePrices[l.packageId] ?? groupNormalTotal;
      if (groupNormalTotal <= 0 || l.qty <= 0) return 0;
      const lineNormalTotal = l.qty * l.part.sell_price;
      const lineShare = (packageTotal * lineNormalTotal) / groupNormalTotal;
      return lineShare / l.qty;
    }
    return Math.max(0, l.part.sell_price - l.discount);
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.qty * l.part.sell_price, 0),
    [cart]
  );
  const itemDiscountsTotal = useMemo(
    () => cart.reduce((sum, l) => sum + (l.qty * l.part.sell_price - l.qty * lineEffectiveUnitPrice(l)), 0),
    [cart, packagePrices]
  );
  const total = Math.max(0, subtotal - itemDiscountsTotal - discount);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const matchRank = (p: PartRow) => {
      const name = p.name.toLowerCase();
      const sku = p.sku?.toLowerCase() ?? "";
      const barcode = p.barcode?.toLowerCase() ?? "";
      if (sku === q || barcode === q) return 0;
      if (sku.startsWith(q) || barcode.startsWith(q)) return 1;
      if (name.startsWith(q)) return 2;
      return 3;
    };
    return initialParts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      )
      .sort((a, b) => matchRank(a) - matchRank(b))
      .slice(0, 20);
  }, [search, initialParts]);

  function addPart(part: PartRow) {
    setCart((prev) => {
      const existing = prev.find((l) => l.part.id === part.id);
      if (existing) {
        return prev.map((l) => (l.part.id === part.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { part, qty: 1, discount: 0 }];
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

  function updateLineDiscount(partId: string, discount: number) {
    setCart((prev) =>
      prev.map((l) =>
        l.part.id === partId ? { ...l, discount: Math.min(Math.max(0, discount), l.part.sell_price) } : l
      )
    );
  }

  function removeLine(partId: string) {
    setCart((prev) => {
      const removed = prev.find((l) => l.part.id === partId);
      const next = prev.filter((l) => l.part.id !== partId);
      if (removed?.packageId) {
        const remaining = next.filter((l) => l.packageId === removed.packageId);
        if (remaining.length < 2) {
          return next.map((l) => (l.packageId === removed.packageId ? { ...l, packageId: undefined } : l));
        }
      }
      return next;
    });
  }

  function openPackageModal() {
    setPackageSelection(new Set());
    setPackagePriceInput("");
    setShowPackageModal(true);
  }

  function togglePackageSelection(partId: string) {
    setPackageSelection((prev) => {
      const next = new Set(prev);
      next.has(partId) ? next.delete(partId) : next.add(partId);
      return next;
    });
  }

  const packageableLines = cart.filter((l) => !l.packageId);
  const packageSelectionNormalTotal = cart
    .filter((l) => packageSelection.has(l.part.id))
    .reduce((sum, l) => sum + l.qty * l.part.sell_price, 0);

  function handleCreatePackage() {
    if (packageSelection.size < 2) {
      setAlertMessage("Select at least two items to make a package.");
      return;
    }
    const price = Number(packagePriceInput);
    if (!price || price <= 0) {
      setAlertMessage("Enter a package price.");
      return;
    }
    const packageId = crypto.randomUUID();
    setCart((prev) =>
      prev.map((l) => (packageSelection.has(l.part.id) ? { ...l, packageId, discount: 0 } : l))
    );
    setPackagePrices((prev) => ({ ...prev, [packageId]: price }));
    setShowPackageModal(false);
  }

  function breakPackage(packageId: string) {
    setCart((prev) => prev.map((l) => (l.packageId === packageId ? { ...l, packageId: undefined } : l)));
    setPackagePrices((prev) => {
      const next = { ...prev };
      delete next[packageId];
      return next;
    });
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
    if (newCustomerMode && !newCustomerName.trim()) {
      setError("Enter the new customer's name.");
      return;
    }
    if (newCustomerMode && newCustomerName.trim() && !isValidName(newCustomerName)) {
      setAlertMessage("The name you have entered is incorrect.");
      return;
    }
    const newCustomerFullPhone = combinePhone(newCustomerPhoneCountry, newCustomerPhone);
    if (newCustomerMode && newCustomerFullPhone && !isValidPhone(newCustomerFullPhone)) {
      setAlertMessage("The mobile number you have entered is incorrect.");
      return;
    }
    const hasCustomer = newCustomerMode ? !!newCustomerName.trim() : !!customerId;
    if ((paymentMethod === "credit" || paymentMethod === "mixed") && !hasCustomer) {
      setError("Select or enter a customer for credit or mixed payment.");
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
    let createdSaleId: string | null = null;
    try {
      let finalCustomerId = customerId || null;

      if (newCustomerMode && newCustomerName.trim()) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({ name: combineTitleName(newCustomerTitle, newCustomerName), phone: newCustomerFullPhone || null })
          .select()
          .single();
        if (customerError || !newCustomer) throw customerError ?? new Error("Could not save customer");
        finalCustomerId = newCustomer.id;
      }

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: finalCustomerId,
          cashier_id: cashierId,
          subtotal,
          discount: itemDiscountsTotal + discount,
          tax: 0,
          total,
          amount_paid: paid,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (saleError || !sale) throw saleError ?? new Error("Could not create sale");
      createdSaleId = sale.id;

      const ungroupedLines = cart.filter((l) => !l.packageId);
      if (ungroupedLines.length > 0) {
        const { error: itemsError } = await supabase.from("sale_items").insert(
          ungroupedLines.map((l) => {
            const unitPrice = Math.max(0, l.part.sell_price - l.discount);
            return {
              sale_id: sale.id,
              part_id: l.part.id,
              qty: l.qty,
              unit_price: unitPrice,
              line_total: l.qty * unitPrice,
            };
          })
        );
        if (itemsError) throw itemsError;
      }

      const packageIds = Array.from(new Set(cart.map((l) => l.packageId).filter((id): id is string => !!id)));
      for (const packageId of packageIds) {
        const group = cart.filter((l) => l.packageId === packageId);
        const { error: packageError } = await supabase.rpc("create_package_sale_items", {
          p_sale_id: sale.id,
          p_items: group.map((l) => ({
            part_id: l.part.id,
            qty: l.qty,
            unit_price: Number(lineEffectiveUnitPrice(l).toFixed(2)),
          })),
        });
        if (packageError) throw packageError;
      }

      if (paymentMethod === "cheque") {
        const { error: chequeError } = await supabase.from("cheques").insert({
          direction: "received",
          related_sale_id: sale.id,
          customer_id: finalCustomerId,
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
      if (createdSaleId) {
        await supabase.from("sales").delete().eq("id", createdSaleId);
      }
      const message =
        err instanceof Error ? err.message : (err as { message?: string } | null)?.message ?? null;
      setError(message ?? "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">New Sale</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={openPackageModal}
              disabled={packageableLines.length < 2}
              title="Sell two or more items together at one combined price"
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" strokeLinejoin="round" />
                <path d="M3 6.5V13l7 3.5 7-3.5V6.5" strokeLinejoin="round" />
                <path d="M10 10v6.5" />
              </svg>
              Create Package
            </button>
            <button
              onClick={handleOpenDrawer}
              disabled={openingDrawer}
              title="Open the cash drawer"
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <rect x="2.5" y="4" width="15" height="9" rx="1" />
                <path d="M2.5 13v2.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V13" />
                <path d="M8.5 8.5h3" strokeLinecap="round" />
              </svg>
              {openingDrawer ? "Opening..." : "Open Drawer"}
            </button>
          </div>
        </div>

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
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
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
                      {admin && <>Cost ${(p.cost_price ?? 0).toFixed(2)} · </>}${p.sell_price.toFixed(2)} ·{" "}
                      {p.qty_on_hand} in stock
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
                {admin && <th className="text-right px-4 py-2 font-medium">Cost</th>}
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-center px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Discount</th>
                <th className="text-right px-4 py-2 font-medium">Line Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={admin ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                    Cart is empty — scan or search for a part above.
                  </td>
                </tr>
              ) : (
                cart.map((l) => {
                  const unitPrice = lineEffectiveUnitPrice(l);
                  return (
                    <tr key={l.part.id} className={l.packageId ? "bg-amber-50" : undefined}>
                      <td className="px-4 py-2 text-slate-800">
                        {l.part.name}
                        {l.packageId && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-200 text-amber-900 text-[10px] font-semibold px-1.5 py-0.5 align-middle">
                            📦 Package
                          </span>
                        )}
                      </td>
                      {admin && (
                        <td className="px-4 py-2 text-right text-slate-500">
                          ${(l.part.cost_price ?? 0).toFixed(2)}
                        </td>
                      )}
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
                      <td className="px-4 py-2 text-right">
                        {l.packageId ? (
                          <span className="text-xs text-amber-700">pkg price</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={l.part.sell_price}
                            value={l.discount}
                            onChange={(e) => updateLineDiscount(l.part.id, Number(e.target.value))}
                            title="Discount per unit"
                            className="w-20 text-right rounded border border-slate-300 py-1 px-1"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">
                        ${(l.qty * unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {l.packageId && (
                          <button
                            onClick={() => breakPackage(l.packageId!)}
                            className="text-amber-700 hover:text-amber-900 text-xs font-medium mr-3"
                          >
                            Break
                          </button>
                        )}
                        <button
                          onClick={() => removeLine(l.part.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h2 className="font-semibold text-slate-800">Payment</h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Customer</label>
              <button
                type="button"
                onClick={() => {
                  setNewCustomerMode((v) => !v);
                  setCustomerId("");
                  setNewCustomerTitle("");
                  setNewCustomerName("");
                  setNewCustomerPhone("");
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                {newCustomerMode ? "Choose existing customer" : "+ New customer"}
              </button>
            </div>
            {newCustomerMode ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={newCustomerTitle}
                    onChange={(e) => setNewCustomerTitle(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-2 w-24 shrink-0"
                  >
                    <option value="">Title</option>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={newCustomerPhoneCountry}
                    onChange={(e) => setNewCustomerPhoneCountry(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-2 w-36 shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.name} value={c.dialCode}>
                        {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Phone (optional, e.g. 771234567)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_code} — {c.name}{" "}
                    {c.credit_balance > 0 ? `(owes $${c.credit_balance.toFixed(2)})` : ""}
                  </option>
                ))}
              </select>
            )}
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
            {itemDiscountsTotal > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Item Discounts</span>
                <span>-${itemDiscountsTotal.toFixed(2)}</span>
              </div>
            )}
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

    {showPackageModal && (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowPackageModal(false);
        }}
      >
        <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Create Package</h2>
            <p className="text-sm text-slate-500">
              Select two or more cart items and set one combined price for all of them together.
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {packageableLines.map((l) => (
              <label
                key={l.part.id}
                className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={packageSelection.has(l.part.id)}
                    onChange={() => togglePackageSelection(l.part.id)}
                  />
                  {l.part.name} × {l.qty}
                </span>
                <span className="text-slate-500">${(l.qty * l.part.sell_price).toFixed(2)}</span>
              </label>
            ))}
            {packageableLines.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">
                No ungrouped items in the cart. Add items first, or break an existing package.
              </p>
            )}
          </div>

          {packageSelection.size > 0 && (
            <p className="text-sm text-slate-500">
              Normal total for selected items: ${packageSelectionNormalTotal.toFixed(2)}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Package price</label>
            <input
              type="number"
              min={0}
              value={packagePriceInput}
              onChange={(e) => setPackagePriceInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <p className="text-xs text-slate-400 mt-1">
              This can be less than the normal total, as long as it still covers the combined cost of
              the selected items plus 3% profit.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPackageModal(false)}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePackage}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Create Package
            </button>
          </div>
        </div>
      </div>
    )}

    {alertMessage && (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setAlertMessage(null);
        }}
      >
        <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-slate-700">{alertMessage}</p>
          <button
            onClick={() => setAlertMessage(null)}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    )}
    </>
  );
}
