import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import Link from "next/link";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [todaySalesRes, lowStockRes, chequesDueRes] = await Promise.all([
    supabase
      .from("sales")
      .select("total, cashier_id")
      .gte("created_at", startOfToday())
      .eq("status", "completed"),
    supabase
      .from("parts")
      .select("id, name, qty_on_hand, low_stock_threshold")
      .eq("is_active", true)
      .order("qty_on_hand", { ascending: true })
      .limit(50),
    supabase
      .from("cheques")
      .select("id, cheque_number, amount, due_date, direction, status")
      .eq("status", "pending")
      .lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
      .order("due_date", { ascending: true }),
  ]);

  const todaySales = todaySalesRes.data ?? [];
  const myTodaySales = admin
    ? todaySales
    : todaySales.filter((s) => s.cashier_id === profile?.id);
  const todayTotal = myTodaySales.reduce((sum, s) => sum + Number(s.total), 0);

  const lowStock = (lowStockRes.data ?? []).filter(
    (p) => Number(p.qty_on_hand) <= Number(p.low_stock_threshold)
  );

  const chequesDue = chequesDueRes.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {admin ? "Dashboard" : `Welcome, ${profile?.full_name ?? ""}`}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">
            {admin ? "Today's Sales (all staff)" : "Your Sales Today"}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {todayTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })}
          </div>
          <div className="text-xs text-slate-400 mt-1">{myTodaySales.length} sale(s)</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Low Stock Parts</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{lowStock.length}</div>
          <Link href="/inventory" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
            View inventory →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-sm text-slate-500">Cheques Due (7 days)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{chequesDue.length}</div>
          <Link href="/cheques" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
            View cheques →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Low Stock
          </div>
          {lowStock.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">All parts are sufficiently stocked.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="px-5 py-3 flex justify-between text-sm">
                  <span className="text-slate-800">{p.name}</span>
                  <span className="text-red-600 font-medium">
                    {p.qty_on_hand} left (min {p.low_stock_threshold})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
            Cheques Due Soon
          </div>
          {chequesDue.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No cheques due in the next 7 days.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {chequesDue.slice(0, 8).map((c) => {
                const overdue = c.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <li key={c.id} className="px-5 py-3 flex justify-between text-sm">
                    <span className="text-slate-800">
                      #{c.cheque_number} · {c.direction === "received" ? "From customer" : "To supplier"}
                    </span>
                    <span className={overdue ? "text-red-600 font-medium" : "text-amber-600 font-medium"}>
                      {c.due_date}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Link
        href="/pos"
        className="inline-block rounded-lg bg-blue-600 text-white font-medium px-5 py-2.5 hover:bg-blue-700 transition"
      >
        + New Sale
      </Link>
    </div>
  );
}
