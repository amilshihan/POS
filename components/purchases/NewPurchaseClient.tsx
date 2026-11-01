"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";

type Supplier = { id: string; name: string; phone: string | null; address: string | null };
type Part = {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  retail_price: number;
  supplier_id: string | null;
};

type Line = {
  key: string;
  part: Part | null; // null = this will create a new product on save
  name: string;
  sku: string;
  qty: number;
  unitCost: number;
  discount: number;
  retailPrice: string;
};

type ExtractedItem = {
  name: string;
  sku: string | null;
  qty: number;
  unit_cost: number;
  discount: number;
  retail_price: number | null;
};

type ExtractedInvoice = {
  supplier: { name: string | null; phone: string | null; address: string | null };
  invoice_number: string | null;
  invoice_date: string | null;
  items: ExtractedItem[];
};

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

export default function NewPurchaseClient({
  suppliers,
  parts,
  purchasedBy,
}: {
  suppliers: Supplier[];
  parts: Part[];
  purchasedBy: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrencySymbol();

  const [supplierId, setSupplierId] = useState("");
  const [newSupplierMode, setNewSupplierMode] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [scanFile, setScanFile] = useState<{ url: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pendingScanExtract, setPendingScanExtract] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lineTotal = (l: Line) => Math.max(0, l.qty * l.unitCost);
  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0) - overallDiscount, [lines, overallDiscount]);

  const supplierParts = useMemo(() => {
    if (newSupplierMode || !supplierId) return [];
    return parts.filter((p) => p.supplier_id === supplierId);
  }, [parts, supplierId, newSupplierMode]);

  const filteredParts = useMemo(() => {
    if (!search.trim()) {
      // No search typed yet: let the user browse and pick straight from this supplier's own items.
      return supplierParts.slice(0, 20);
    }
    const q = search.toLowerCase();
    const pool = supplierParts.length > 0 ? supplierParts : parts;
    const matches = pool.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    if (matches.length > 0 || pool === parts) return matches.slice(0, 8);
    // Nothing from this supplier matched — fall back to searching every product.
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, parts, supplierParts]);

  function addPart(part: Part) {
    setLines((prev) => {
      const existing = prev.find((l) => l.part?.id === part.id);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...prev,
        {
          key: newKey(),
          part,
          name: part.name,
          sku: part.sku ?? "",
          qty: 1,
          unitCost: part.cost_price,
          discount: 0,
          retailPrice: "",
        },
      ];
    });
    setSearch("");
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function clearAll() {
    setSupplierId("");
    setNewSupplierMode(false);
    setNewSupplierName("");
    setNewSupplierPhone("");
    setNewSupplierAddress("");
    setInvoiceNumber("");
    setInvoiceDate("");
    setOverallDiscount(0);
    setSearch("");
    setLines([]);
    setError(null);
    setScanFile(null);
    setScanError(null);
    setPendingScanExtract(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function matchExistingPart(key: string, part: Part) {
    updateLine(key, { part, name: part.name, sku: part.sku ?? "", unitCost: part.cost_price });
  }

  async function handleScanFile(file: File) {
    setScanError(null);
    setScanning(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `invoice-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("purchase-invoices").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("purchase-invoices").getPublicUrl(path);
      setScanFile({ url: publicUrlData.publicUrl, name: file.name });

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/purchases/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read the invoice.");

      const extracted = data.extracted as ExtractedInvoice;
      setPendingScanExtract(extracted);
      applyExtractedInvoice(extracted);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Could not scan the invoice.");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function applyExtractedInvoice(extracted: ExtractedInvoice) {
    if (extracted.invoice_number) setInvoiceNumber(extracted.invoice_number);
    if (extracted.invoice_date) setInvoiceDate(extracted.invoice_date);

    const supplierName = extracted.supplier?.name?.trim();
    if (supplierName) {
      const match = suppliers.find((s) => s.name.toLowerCase() === supplierName.toLowerCase());
      if (match) {
        setNewSupplierMode(false);
        setSupplierId(match.id);
      } else {
        setNewSupplierMode(true);
        setNewSupplierName(supplierName);
        setNewSupplierPhone(extracted.supplier.phone ?? "");
        setNewSupplierAddress(extracted.supplier.address ?? "");
      }
    }

    const newLines: Line[] = (extracted.items ?? []).map((item) => {
      const matched = parts.find(
        (p) =>
          p.name.toLowerCase() === item.name.toLowerCase() ||
          (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase())
      );
      return {
        key: newKey(),
        part: matched ?? null,
        name: item.name,
        sku: item.sku ?? matched?.sku ?? "",
        qty: item.qty || 1,
        unitCost: item.unit_cost || 0,
        discount: item.discount || 0,
        retailPrice: item.retail_price != null ? String(item.retail_price) : "",
      };
    });
    setLines((prev) => [...prev, ...newLines]);
  }

  async function handleSave() {
    setError(null);
    if (!newSupplierMode && !supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (newSupplierMode && !newSupplierName.trim()) {
      setError("Enter the new supplier's name.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one part.");
      return;
    }
    for (const l of lines) {
      if (!l.part && !l.name.trim()) {
        setError("Every new item needs a name.");
        return;
      }
    }

    setSaving(true);
    try {
      let finalSupplierId = supplierId;
      if (newSupplierMode) {
        const { data: newSupplier, error: supplierError } = await supabase
          .from("suppliers")
          .insert({
            name: newSupplierName.trim(),
            phone: newSupplierPhone.trim() || null,
            address: newSupplierAddress.trim() || null,
          })
          .select()
          .single();
        if (supplierError || !newSupplier) throw supplierError ?? new Error("Could not save supplier");
        finalSupplierId = newSupplier.id;
      }

      // Create any new products first so purchase_items has a part_id to reference.
      const resolvedLines: (Line & { part: Part })[] = [];
      for (const l of lines) {
        if (l.part) {
          resolvedLines.push(l as Line & { part: Part });
          continue;
        }
        const { data: newPart, error: partError } = await supabase
          .from("parts")
          .insert({
            name: l.name.trim(),
            sku: l.sku.trim() || null,
            cost_price: l.unitCost,
            sell_price: l.unitCost * 1.03,
            retail_price: l.retailPrice ? Number(l.retailPrice) : 0,
            qty_on_hand: 0,
            unit: "pcs",
            supplier_id: finalSupplierId,
          })
          .select()
          .single();
        if (partError || !newPart) throw partError ?? new Error(`Could not create product "${l.name}"`);
        resolvedLines.push({ ...l, part: newPart });
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier_id: finalSupplierId,
          purchased_by: purchasedBy,
          total,
          discount: overallDiscount,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: invoiceDate || null,
          payment_status: "unpaid",
        })
        .select()
        .single();
      if (purchaseError || !purchase) throw purchaseError ?? new Error("Could not create purchase");

      const { error: itemsError } = await supabase.from("purchase_items").insert(
        resolvedLines.map((l) => ({
          purchase_id: purchase.id,
          part_id: l.part.id,
          qty: l.qty,
          unit_cost: l.unitCost,
          discount: l.discount,
          retail_price: l.retailPrice ? Number(l.retailPrice) : null,
          line_total: lineTotal(l),
        }))
      );
      if (itemsError) throw itemsError;

      if (scanFile) {
        await supabase.from("purchase_invoice_scans").insert({
          file_url: scanFile.url,
          file_name: scanFile.name,
          extracted_data: pendingScanExtract,
          purchase_id: purchase.id,
          uploaded_by: purchasedBy,
        });
      }

      router.push("/purchases");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">New Purchase</h1>
        {(lines.length > 0 || supplierId || newSupplierMode || invoiceNumber || scanFile) && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Scan a purchase invoice</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {scanning ? "Reading invoice..." : "Upload Invoice"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScanFile(file);
            }}
          />
        </div>
        {scanFile && (
          <p className="text-xs text-slate-500">
            Attached:{" "}
            <a href={scanFile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {scanFile.name}
            </a>
          </p>
        )}
        {scanError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{scanError}</div>}
        <p className="text-xs text-slate-400">
          Upload a photo or PDF of the invoice to pre-fill the supplier and items below — review before saving.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Supplier</label>
          <button
            type="button"
            onClick={() => setNewSupplierMode((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {newSupplierMode ? "Choose existing supplier" : "+ New supplier"}
          </button>
        </div>
        {newSupplierMode ? (
          <div className="space-y-2">
            <input
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Supplier name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex gap-2">
              <input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                placeholder="Address (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
        ) : (
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Select supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs text-slate-500">Invoice #</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Invoice date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 pt-2">Add parts</label>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder={
              supplierParts.length > 0 ? "Browse this supplier's items, or search all products..." : "Search part by name or SKU..."
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {(searchFocused || search.trim()) && filteredParts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
              {!search.trim() && supplierParts.length > 0 && (
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100">
                  Items from this supplier
                </div>
              )}
              {filteredParts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                >
                  {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Part</th>
              <th className="text-center px-4 py-2 font-medium">Qty</th>
              <th className="text-right px-4 py-2 font-medium">Unit Cost (after discount)</th>
              <th className="text-right px-4 py-2 font-medium">Discount (record)</th>
              <th className="text-right px-4 py-2 font-medium">Retail Price</th>
              <th className="text-right px-4 py-2 font-medium">Line Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No parts added yet.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.key} className={!l.part ? "bg-amber-50" : undefined}>
                  <td className="px-4 py-2 text-slate-800">
                    {l.part ? (
                      <span>{l.name}</span>
                    ) : (
                      <div className="space-y-1">
                        <input
                          value={l.name}
                          onChange={(e) => updateLine(l.key, { name: e.target.value })}
                          placeholder="New product name"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={l.sku}
                          onChange={(e) => updateLine(l.key, { sku: e.target.value })}
                          placeholder="SKU (optional)"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <span className="inline-flex items-center rounded-full bg-amber-200 text-amber-900 text-[10px] font-semibold px-1.5 py-0.5">
                          New product — will be created
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                      className="w-16 text-center rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={l.unitCost}
                      onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                      className="w-20 text-right rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={l.discount}
                      onChange={(e) => updateLine(l.key, { discount: Number(e.target.value) })}
                      className="w-20 text-right rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={l.retailPrice}
                      onChange={(e) => updateLine(l.key, { retailPrice: e.target.value })}
                      placeholder="-"
                      className="w-20 text-right rounded border border-slate-300 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {currency}
                    {lineTotal(l).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => removeLine(l.key)}
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

      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 shrink-0">Overall discount</label>
          <input
            type="number"
            min={0}
            value={overallDiscount}
            onChange={(e) => setOverallDiscount(Number(e.target.value))}
            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="text-lg font-bold text-slate-900">
            Total: {currency}
            {total.toFixed(2)}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 text-white font-semibold px-6 py-2.5 hover:bg-blue-700 disabled:opacity-60 shrink-0"
          >
            {saving ? "Saving..." : "Save Purchase"}
          </button>
        </div>
      </div>
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
    </div>
  );
}
