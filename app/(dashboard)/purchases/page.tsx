import { createClient } from "@/lib/supabase/server";
import PurchasesClient from "@/components/purchases/PurchasesClient";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const purchasesRes = await supabase
    .from("purchases")
    .select(
      "id, created_at, invoice_number, invoice_date, total, discount, payment_status, suppliers(name), profiles!purchases_purchased_by_fkey(full_name), purchase_invoice_scans(id, file_url, file_name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <PurchasesClient
      initialPurchases={(purchasesRes.data ?? []) as unknown as Array<{
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
      }>}
    />
  );
}
