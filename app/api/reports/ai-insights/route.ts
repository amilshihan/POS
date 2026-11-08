import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `You are a business analyst advising the owner of a small spare-parts retail shop in Sri Lanka ("Amil Auto Hub"). You will be given a JSON snapshot of the shop's recent sales, inventory, and finance data.

Rules:
- Reference actual numbers, product names, categories, or suppliers from the data wherever possible — never generic advice with no connection to the data.
- Each item must have a "category" field, one of: "Promote", "Restock", "Clearance", "Pricing", "Cost Saving", "Collections", "Other".
- Each item must have a short "title" (under 60 characters) and a "detail" (1-3 sentences).
- If a data section is empty or has nothing notable, don't force an item out of it.
- Respond with ONLY a JSON array of objects shaped {"category": string, "title": string, "detail": string}, no markdown fences, no commentary.`;

const GENERAL_INSTRUCTIONS = `Produce 5 to 8 specific, actionable suggestions to improve sales and profitability, prioritized by impact.`;

function questionInstructions(question: string) {
  return `The shop owner asked this specific question: "${question}"

Answer it directly and specifically using the data provided. Each array item should be one concrete fact, item, or recommendation that answers the question — e.g. if asked about overstock items, list the actual overstocked products with their numbers, not generic advice. If the data doesn't contain enough to answer, say so plainly in one item rather than inventing figures. Stay focused on the question; don't pad with unrelated general suggestions.`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: Request) {
  const { profile } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let question = "";
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  } catch {
    // no body / not JSON — treat as a general insights request
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI insights aren't set up yet. Add ANTHROPIC_API_KEY to the server's .env.local and restart." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const currentStart = daysAgo(30).toISOString();
  const previousStart = daysAgo(60).toISOString();

  const [currentSalesRes, previousSalesRes, currentItemsRes, previousItemsRes, partsRes, customersRes, expensesRes] =
    await Promise.all([
      supabase.from("sales").select("total, amount_paid, payment_method, created_at").eq("status", "completed").gte("created_at", currentStart),
      supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", previousStart)
        .lt("created_at", currentStart),
      supabase
        .from("sale_items")
        .select("qty, line_total, cost_price_snapshot, parts(id, name, category_id, supplier_id), sales!inner(created_at, status)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", currentStart),
      supabase
        .from("sale_items")
        .select("qty, line_total, parts(id, name), sales!inner(created_at, status)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", previousStart)
        .lt("sales.created_at", currentStart),
      supabase
        .from("parts")
        .select("id, name, qty_on_hand, low_stock_threshold, cost_price, sell_price, category_id, supplier_id")
        .eq("is_active", true)
        .eq("is_service", false),
      supabase.from("customers").select("name, credit_balance").gt("credit_balance", 0),
      supabase.from("expenses").select("amount, category").gte("expense_date", currentStart.slice(0, 10)),
    ]);

  const [categoriesRes, suppliersRes] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id"),
    supabase.from("suppliers").select("id, name"),
  ]);

  type SaleRow = { total: number; amount_paid: number; payment_method: string; created_at: string };
  type ItemRow = {
    qty: number;
    line_total: number;
    cost_price_snapshot?: number;
    parts: { id: string; name: string; category_id: string | null; supplier_id: string | null } | null;
  };
  type PartRow = {
    id: string;
    name: string;
    qty_on_hand: number;
    low_stock_threshold: number;
    cost_price: number;
    sell_price: number;
    category_id: string | null;
    supplier_id: string | null;
  };

  const currentSales = (currentSalesRes.data ?? []) as SaleRow[];
  const previousSales = (previousSalesRes.data ?? []) as { total: number }[];
  const currentItems = (currentItemsRes.data ?? []) as unknown as ItemRow[];
  const previousItems = (previousItemsRes.data ?? []) as unknown as ItemRow[];
  const parts = (partsRes.data ?? []) as PartRow[];
  const categories = (categoriesRes.data ?? []) as { id: string; name: string; parent_id: string | null }[];
  const suppliers = (suppliersRes.data ?? []) as { id: string; name: string }[];

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));

  const currentRevenue = currentSales.reduce((s, x) => s + Number(x.total), 0);
  const previousRevenue = previousSales.reduce((s, x) => s + Number(x.total), 0);
  const revenueChangePercent = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const costOfGoodsSold = currentItems.reduce((s, i) => s + Number(i.cost_price_snapshot ?? 0) * Number(i.qty), 0);
  const grossProfit = currentRevenue - costOfGoodsSold;

  const paymentMix: Record<string, number> = {};
  for (const s of currentSales) {
    paymentMix[s.payment_method] = (paymentMix[s.payment_method] ?? 0) + Number(s.amount_paid);
  }

  const soldQtyByPart = new Map<string, number>();
  const revenueByPart = new Map<string, number>();
  for (const i of currentItems) {
    if (!i.parts) continue;
    soldQtyByPart.set(i.parts.id, (soldQtyByPart.get(i.parts.id) ?? 0) + Number(i.qty));
    revenueByPart.set(i.parts.id, (revenueByPart.get(i.parts.id) ?? 0) + Number(i.line_total));
  }

  const topProducts = [...revenueByPart.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([partId, revenue]) => {
      const part = parts.find((p) => p.id === partId);
      return { name: part?.name ?? "Unknown", qty_sold: soldQtyByPart.get(partId) ?? 0, revenue: Math.round(revenue) };
    });

  // "Overstock" = stock that would take a long time to sell through at the
  // current pace, not just items that sold zero units. Zero-sale items are
  // treated as effectively infinite days of stock.
  const OVERSTOCK_DAYS_THRESHOLD = 90;
  const overstockProducts = parts
    .filter((p) => p.qty_on_hand > 0)
    .map((p) => {
      const qtySold = soldQtyByPart.get(p.id) ?? 0;
      const dailyRate = qtySold / 30;
      const daysOfStock = dailyRate > 0 ? Math.round(p.qty_on_hand / dailyRate) : null; // null = no sales at all
      return {
        name: p.name,
        qty_on_hand: p.qty_on_hand,
        qty_sold_last_30_days: qtySold,
        days_of_stock_at_current_pace: daysOfStock, // null means zero sales in 30 days
        tied_up_cost: Math.round(p.qty_on_hand * (p.cost_price ?? 0)),
      };
    })
    .filter((p) => p.days_of_stock_at_current_pace === null || p.days_of_stock_at_current_pace > OVERSTOCK_DAYS_THRESHOLD)
    .sort((a, b) => b.tied_up_cost - a.tied_up_cost)
    .slice(0, 20);

  const lowStockProducts = parts
    .filter((p) => p.qty_on_hand <= p.low_stock_threshold)
    .map((p) => ({ name: p.name, qty_on_hand: p.qty_on_hand, threshold: p.low_stock_threshold }))
    .slice(0, 15);

  const categoryRevenue = new Map<string, number>();
  for (const i of currentItems) {
    const catId = i.parts?.category_id;
    const label = catId ? (categoryNameById.get(catId) ?? "Unknown") : "Uncategorized";
    categoryRevenue.set(label, (categoryRevenue.get(label) ?? 0) + Number(i.line_total));
  }
  const revenueByCategory = [...categoryRevenue.entries()]
    .map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const supplierRevenue = new Map<string, number>();
  for (const i of currentItems) {
    const supId = i.parts?.supplier_id;
    if (!supId) continue;
    const label = supplierNameById.get(supId) ?? "Unknown";
    supplierRevenue.set(label, (supplierRevenue.get(label) ?? 0) + Number(i.line_total));
  }
  const revenueBySupplier = [...supplierRevenue.entries()]
    .map(([supplier, revenue]) => ({ supplier, revenue: Math.round(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const outstandingCredit = (customersRes.data ?? []) as { name: string; credit_balance: number }[];
  const totalOutstandingCredit = outstandingCredit.reduce((s, c) => s + Number(c.credit_balance), 0);

  const expenses = (expensesRes.data ?? []) as { amount: number; category: string }[];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const snapshot = {
    period: "last 30 days vs previous 30 days",
    revenue: { current: Math.round(currentRevenue), previous: Math.round(previousRevenue), change_percent: revenueChangePercent !== null ? Math.round(revenueChangePercent * 10) / 10 : null },
    gross_profit: Math.round(grossProfit),
    total_expenses_last_30_days: Math.round(totalExpenses),
    payment_mix: paymentMix,
    top_products_by_revenue: topProducts,
    overstock_candidates: overstockProducts,
    low_stock_products: lowStockProducts,
    revenue_by_category: revenueByCategory,
    revenue_by_supplier: revenueBySupplier,
    outstanding_customer_credit_total: Math.round(totalOutstandingCredit),
    customers_owing_the_most: outstandingCredit
      .sort((a, b) => Number(b.credit_balance) - Number(a.credit_balance))
      .slice(0, 5)
      .map((c) => ({ name: c.name, owes: Math.round(Number(c.credit_balance)) })),
  };

  void previousItems; // reserved for a future category/product-level trend comparison

  try {
    const anthropic = new Anthropic({ apiKey });
    const system = `${BASE_SYSTEM_PROMPT}\n\n${question ? questionInstructions(question) : GENERAL_INSTRUCTIONS}`;
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: JSON.stringify(snapshot) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("AI insights: no JSON array found. stop_reason:", message.stop_reason, "raw:", raw.slice(0, 2000));
      throw new Error("The AI didn't return readable suggestions. Try again.");
    }
    let suggestions;
    try {
      suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("AI insights: JSON.parse failed. stop_reason:", message.stop_reason, "matched:", jsonMatch[0].slice(0, 2000));
      throw new Error("The AI's response was incomplete. Try again.");
    }
    return NextResponse.json({ suggestions, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate insights." },
      { status: 500 }
    );
  }
}
