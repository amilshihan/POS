import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import InvoicesClient from "@/components/invoices/InvoicesClient";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const [salesRes, settingsRes] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_number, created_at, subtotal, discount, total, amount_paid, payment_method, status, void_reason, customers(name, phone), profiles!sales_cashier_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("shop_settings").select("currency").single(),
  ]);

  const sales = (salesRes.data ?? []) as unknown as {
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
  }[];

  return <InvoicesClient initialSales={sales} currency={settingsRes.data?.currency ?? "LKR"} admin={admin} />;
}
