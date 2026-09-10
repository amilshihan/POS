import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintTrigger from "@/components/pos/PrintTrigger";
import ReceiptView from "@/components/receipt/ReceiptView";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [saleRes, settingsRes] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "*, customers(name, phone), profiles!sales_cashier_id_fkey(full_name), sale_items(qty, unit_price, line_total, parts(name, unit))"
      )
      .eq("id", id)
      .single(),
    supabase.from("shop_settings").select("*").single(),
  ]);

  if (!saleRes.data) notFound();

  const sale = saleRes.data as unknown as {
    sale_number: string;
    created_at: string;
    total: number;
    subtotal: number;
    discount: number;
    amount_paid: number;
    payment_method: string;
    customers: { name: string; phone: string | null } | null;
    profiles: { full_name: string } | null;
    sale_items: { qty: number; unit_price: number; line_total: number; parts: { name: string; unit: string } }[];
  };
  const settings = settingsRes.data ?? {
    shop_name: "Spare Parts Shop",
    address: null,
    phone: null,
    receipt_width_mm: 80,
    receipt_footer: "Thank you!",
  };

  return (
    <>
      <PrintTrigger />
      <ReceiptView sale={sale} settings={settings} />
    </>
  );
}
