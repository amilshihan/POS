"use client";

import Link from "next/link";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";

type Purchase = {
  id: string;
  created_at: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number;
  discount: number;
  payment_status: string;
  suppliers: { name: string } | null;
  profiles: { full_name: string } | null;
  purchase_invoice_scans: { id: string; file_url: string; file_name: string | null }[];
};

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  unpaid: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
};

export default function PurchasesClient({ initialPurchases }: { initialPurchases: Purchase[] }) {
  const symbol = useCurrencySymbol();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
        <Link
          href="/purchases/new"
          className="rounded-lg bg-blue-600 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-700"
        >
          + New Purchase
        </Link>
      </div>

      {initialPurchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-8 text-center text-slate-400">
          No purchases recorded yet.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {initialPurchases.map((p) => {
              const scan = p.purchase_invoice_scans?.[0];
              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{p.suppliers?.name ?? "-"}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(p.invoice_date ?? p.created_at).toLocaleDateString()}
                        {p.invoice_number ? ` · ${p.invoice_number}` : ""}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[p.payment_status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.payment_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Purchased by {p.profiles?.full_name ?? "-"}</span>
                    <span className="font-semibold text-slate-900">
                      {symbol}
                      {Number(p.total).toFixed(2)}
                    </span>
                  </div>
                  {scan && (
                    <a
                      href={scan.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-blue-600 hover:underline text-xs"
                    >
                      View scan
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-2 font-medium">Supplier</th>
                  <th className="text-left px-4 py-2 font-medium">Purchased By</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Invoice File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialPurchases.map((p) => {
                  const scan = p.purchase_invoice_scans?.[0];
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-slate-700">
                        {new Date(p.invoice_date ?? p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{p.invoice_number ?? "-"}</td>
                      <td className="px-4 py-2 text-slate-800 font-medium">{p.suppliers?.name ?? "-"}</td>
                      <td className="px-4 py-2 text-slate-600">{p.profiles?.full_name ?? "-"}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">
                        {symbol}
                        {Number(p.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_BADGE[p.payment_status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {scan ? (
                          <a
                            href={scan.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            View scan
                          </a>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
