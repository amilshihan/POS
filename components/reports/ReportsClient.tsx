"use client";

import { useState } from "react";
import OverviewTab from "./OverviewTab";
import SalesTrendTab from "./SalesTrendTab";
import ItemMovementTab from "./ItemMovementTab";
import CategoryTab from "./CategoryTab";
import SupplierTab from "./SupplierTab";

type Part = { id: string; name: string; sku: string | null; qty_on_hand: number };
type Category = { id: string; name: string; parent_id: string | null };
type Supplier = { id: string; name: string };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales Trend" },
  { id: "item", label: "Item Movement" },
  { id: "category", label: "By Category" },
  { id: "supplier", label: "By Supplier" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function ReportsClient({
  overview,
  parts,
  categories,
  suppliers,
}: {
  overview: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    byStaff: [string, number][];
    topParts: [string, { qty: number; revenue: number }][];
    outstandingCredit: { name: string; credit_balance: number }[];
  };
  parts: Part[];
  categories: Category[];
  suppliers: Supplier[];
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab {...overview} />}
      {tab === "sales" && <SalesTrendTab />}
      {tab === "item" && <ItemMovementTab parts={parts} />}
      {tab === "category" && <CategoryTab categories={categories} />}
      {tab === "supplier" && <SupplierTab suppliers={suppliers} />}
    </div>
  );
}
