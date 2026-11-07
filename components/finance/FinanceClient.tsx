"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";

type Sale = {
  id: string;
  total: number;
  amount_paid: number;
  payment_method: string;
  commission_percent_snapshot: number | null;
  created_at: string;
};
type SaleItem = { qty: number; cost_price_snapshot: number; sales: { created_at: string; status: string } };
type Payment = { amount: number; method: string; commission_percent_snapshot: number | null; created_at: string };
type Expense = { amount: number; payment_method: string; expense_date: string };

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyOf(key: string) {
  return key.slice(0, 7);
}

function datesBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function cogsByDate(saleItems: SaleItem[]) {
  const map = new Map<string, number>();
  for (const item of saleItems) {
    if (!item.sales) continue;
    const key = dateKey(item.sales.created_at);
    map.set(key, (map.get(key) ?? 0) + Number(item.qty) * Number(item.cost_price_snapshot));
  }
  return map;
}

function commissionByDate(sales: Sale[], payments: Payment[]) {
  const map = new Map<string, number>();
  for (const s of sales) {
    if (!s.commission_percent_snapshot) continue;
    const key = dateKey(s.created_at);
    const amount = (Number(s.amount_paid) * Number(s.commission_percent_snapshot)) / 100;
    map.set(key, (map.get(key) ?? 0) + amount);
  }
  for (const p of payments) {
    if (!p.commission_percent_snapshot) continue;
    const key = dateKey(p.created_at);
    const amount = (Number(p.amount) * Number(p.commission_percent_snapshot)) / 100;
    map.set(key, (map.get(key) ?? 0) + amount);
  }
  return map;
}

function periodStats(
  sales: Sale[],
  cogsMap: Map<string, number>,
  commissionMap: Map<string, number>,
  expenses: Expense[],
  matches: (saleDateKey: string) => boolean,
  expenseMatches: (expenseDate: string) => boolean
) {
  let revenue = 0;
  let cogs = 0;
  let commission = 0;
  for (const s of sales) {
    if (matches(dateKey(s.created_at))) revenue += Number(s.total);
  }
  for (const [key, value] of cogsMap.entries()) {
    if (matches(key)) cogs += value;
  }
  for (const [key, value] of commissionMap.entries()) {
    if (matches(key)) commission += value;
  }
  let expenseTotal = 0;
  for (const e of expenses) {
    if (expenseMatches(e.expense_date)) expenseTotal += Number(e.amount);
  }
  return {
    revenue,
    cogs,
    expenses: expenseTotal,
    commission,
    profit: revenue - cogs - expenseTotal - commission,
  };
}

function channelBreakdown(
  sales: Sale[],
  payments: Payment[],
  matchesSale: (k: string) => boolean,
  matchesPayment: (k: string) => boolean
) {
  const totals: Record<string, number> = { cash: 0, card: 0, online: 0 };
  let commission = 0;
  for (const s of sales) {
    if (!matchesSale(dateKey(s.created_at))) continue;
    if (s.payment_method in totals) totals[s.payment_method] += Number(s.amount_paid);
    if (s.commission_percent_snapshot) commission += (Number(s.amount_paid) * Number(s.commission_percent_snapshot)) / 100;
  }
  for (const p of payments) {
    if (!matchesPayment(dateKey(p.created_at))) continue;
    if (p.method in totals) totals[p.method] += Number(p.amount);
    if (p.commission_percent_snapshot) commission += (Number(p.amount) * Number(p.commission_percent_snapshot)) / 100;
  }
  return { totals, commission };
}

export default function FinanceClient({
  sales,
  saleItems,
  payments,
  expenses,
  rangeFrom,
  rangeTo,
  rangedSales,
  rangedSaleItems,
  rangedPayments,
  rangedExpenses,
}: {
  sales: Sale[];
  saleItems: SaleItem[];
  payments: Payment[];
  expenses: Expense[];
  rangeFrom: string;
  rangeTo: string;
  rangedSales: Sale[];
  rangedSaleItems: SaleItem[];
  rangedPayments: Payment[];
  rangedExpenses: Expense[];
}) {
  const currency = useCurrencySymbol();
  const router = useRouter();
  const today = todayKey();
  const thisMonth = monthKeyOf(today);
  const thisYear = today.slice(0, 4);

  const [fromInput, setFromInput] = useState(rangeFrom);
  const [toInput, setToInput] = useState(rangeTo);

  const cogsBySaleDate = useMemo(() => cogsByDate(saleItems), [saleItems]);
  const rangedCogsBySaleDate = useMemo(() => cogsByDate(rangedSaleItems), [rangedSaleItems]);
  const commissionBySaleDate = useMemo(() => commissionByDate(sales, payments), [sales, payments]);
  const rangedCommissionBySaleDate = useMemo(
    () => commissionByDate(rangedSales, rangedPayments),
    [rangedSales, rangedPayments]
  );

  const todayStats = periodStats(sales, cogsBySaleDate, commissionBySaleDate, expenses, (k) => k === today, (k) => k === today);
  const monthStats = periodStats(
    sales,
    cogsBySaleDate,
    commissionBySaleDate,
    expenses,
    (k) => monthKeyOf(k) === thisMonth,
    (k) => monthKeyOf(k) === thisMonth
  );
  const yearStats = periodStats(
    sales,
    cogsBySaleDate,
    commissionBySaleDate,
    expenses,
    (k) => k.slice(0, 4) === thisYear,
    (k) => k.slice(0, 4) === thisYear
  );

  const rangeStats = periodStats(
    rangedSales,
    rangedCogsBySaleDate,
    rangedCommissionBySaleDate,
    rangedExpenses,
    (k) => k >= rangeFrom && k <= rangeTo,
    (k) => k >= rangeFrom && k <= rangeTo
  );
  const rangeChannels = channelBreakdown(
    rangedSales,
    rangedPayments,
    (k) => k >= rangeFrom && k <= rangeTo,
    (k) => k >= rangeFrom && k <= rangeTo
  );

  const rangedTrend = useMemo(() => {
    return datesBetween(rangeFrom, rangeTo).map((key) => {
      const revenue = rangedSales.filter((s) => dateKey(s.created_at) === key).reduce((s, x) => s + Number(x.total), 0);
      const cogs = rangedCogsBySaleDate.get(key) ?? 0;
      const commission = rangedCommissionBySaleDate.get(key) ?? 0;
      const expenseTotal = rangedExpenses.filter((e) => e.expense_date === key).reduce((s, e) => s + Number(e.amount), 0);
      return { date: key, revenue, expenses: expenseTotal, profit: revenue - cogs - expenseTotal - commission };
    });
  }, [rangeFrom, rangeTo, rangedSales, rangedCogsBySaleDate, rangedCommissionBySaleDate, rangedExpenses]);

  function applyRange() {
    if (!fromInput || !toInput) return;
    router.push(`/finance?from=${fromInput}&to=${toInput}`);
  }

  function setPreset(from: string, to: string) {
    setFromInput(from);
    setToInput(to);
    router.push(`/finance?from=${from}&to=${to}`);
  }

  const StatCard = ({ title, stats }: { title: string; stats: ReturnType<typeof periodStats> }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Revenue</span>
        <span className="font-medium text-slate-900">
          {currency}
          {stats.revenue.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Expenses</span>
        <span className="font-medium text-red-600">
          {currency}
          {stats.expenses.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Commission</span>
        <span className="font-medium text-red-600">
          {currency}
          {stats.commission.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
        <span className="text-slate-600 font-medium">Net Profit</span>
        <span className={`font-bold ${stats.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
          {currency}
          {stats.profit.toFixed(2)}
        </span>
      </div>
    </div>
  );

  const ChannelCard = ({
    title,
    channels,
  }: {
    title: string;
    channels: { totals: Record<string, number>; commission: number };
  }) => {
    const totalReceived = channels.totals.cash + channels.totals.card + channels.totals.online;
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Cash Received</span>
          <span className="font-medium text-slate-900">
            {currency}
            {channels.totals.cash.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Online Payments Received</span>
          <span className="font-medium text-slate-900">
            {currency}
            {channels.totals.online.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Credit Card Received</span>
          <span className="font-medium text-slate-900">
            {currency}
            {channels.totals.card.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
          <span className="text-slate-500">Commission Paid</span>
          <span className="font-medium text-red-600">
            -{currency}
            {channels.commission.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 font-medium">Net After Commission</span>
          <span className="font-bold text-slate-900">
            {currency}
            {(totalReceived - channels.commission).toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Finance</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Today" stats={todayStats} />
        <StatCard title="This Month" stats={monthStats} />
        <StatCard title="This Year" stats={yearStats} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500">From</label>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="block rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">To</label>
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="block rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            onClick={applyRange}
            className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 text-sm hover:bg-blue-700"
          >
            Apply
          </button>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPreset(today, today)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 6);
                setPreset(d.toISOString().slice(0, 10), today);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 29);
                setPreset(d.toISOString().slice(0, 10), today);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPreset(`${thisMonth}-01`, today)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              This Month
            </button>
            <button
              onClick={() => setPreset(`${thisYear}-01-01`, today)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              This Year
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title={`Selected Range (${rangeFrom} to ${rangeTo})`} stats={rangeStats} />
        <ChannelCard title={`Revenue by Channel (${rangeFrom} to ${rangeTo})`} channels={rangeChannels} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
          Daily Trend — {rangeFrom} to {rangeTo}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-right px-4 py-2 font-medium">Revenue</th>
              <th className="text-right px-4 py-2 font-medium">Expenses</th>
              <th className="text-right px-4 py-2 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rangedTrend.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No data in this range.
                </td>
              </tr>
            ) : (
              rangedTrend
                .slice()
                .reverse()
                .map((d) => (
                  <tr key={d.date}>
                    <td className="px-4 py-2 text-slate-700">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right text-slate-800">
                      {currency}
                      {d.revenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {currency}
                      {d.expenses.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${d.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {currency}
                      {d.profit.toFixed(2)}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
