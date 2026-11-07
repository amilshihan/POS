import { createClient } from "@/lib/supabase/server";
import FinanceClient from "@/components/finance/FinanceClient";

function startOfYear() {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const since = startOfYear();

  const { from: fromParam, to: toParam } = await searchParams;
  const rangeFrom = fromParam || daysAgoStr(29);
  const rangeTo = toParam || todayStr();
  const rangeToExclusive = new Date(new Date(rangeTo + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [salesRes, itemsRes, paymentsRes, expensesRes, rangedSalesRes, rangedItemsRes, rangedPaymentsRes, rangedExpensesRes] =
    await Promise.all([
      supabase
        .from("sales")
        .select("id, total, amount_paid, payment_method, created_at")
        .eq("status", "completed")
        .gte("created_at", since),
      supabase
        .from("sale_items")
        .select("qty, cost_price_snapshot, sales!inner(created_at, status)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", since),
      supabase.from("payments").select("amount, method, created_at").gte("created_at", since),
      supabase.from("expenses").select("amount, payment_method, expense_date").gte("expense_date", since.slice(0, 10)),
      supabase
        .from("sales")
        .select("id, total, amount_paid, payment_method, created_at")
        .eq("status", "completed")
        .gte("created_at", rangeFrom)
        .lt("created_at", rangeToExclusive),
      supabase
        .from("sale_items")
        .select("qty, cost_price_snapshot, sales!inner(created_at, status)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", rangeFrom)
        .lt("sales.created_at", rangeToExclusive),
      supabase.from("payments").select("amount, method, created_at").gte("created_at", rangeFrom).lt("created_at", rangeToExclusive),
      supabase.from("expenses").select("amount, payment_method, expense_date").gte("expense_date", rangeFrom).lte("expense_date", rangeTo),
    ]);

  return (
    <FinanceClient
      sales={(salesRes.data ?? []) as Array<{
        id: string;
        total: number;
        amount_paid: number;
        payment_method: string;
        created_at: string;
      }>}
      saleItems={
        (itemsRes.data ?? []) as unknown as Array<{
          qty: number;
          cost_price_snapshot: number;
          sales: { created_at: string; status: string };
        }>
      }
      payments={(paymentsRes.data ?? []) as Array<{ amount: number; method: string; created_at: string }>}
      expenses={(expensesRes.data ?? []) as Array<{ amount: number; payment_method: string; expense_date: string }>}
      rangeFrom={rangeFrom}
      rangeTo={rangeTo}
      rangedSales={(rangedSalesRes.data ?? []) as Array<{
        id: string;
        total: number;
        amount_paid: number;
        payment_method: string;
        created_at: string;
      }>}
      rangedSaleItems={
        (rangedItemsRes.data ?? []) as unknown as Array<{
          qty: number;
          cost_price_snapshot: number;
          sales: { created_at: string; status: string };
        }>
      }
      rangedPayments={(rangedPaymentsRes.data ?? []) as Array<{ amount: number; method: string; created_at: string }>}
      rangedExpenses={(rangedExpensesRes.data ?? []) as Array<{ amount: number; payment_method: string; expense_date: string }>}
    />
  );
}
