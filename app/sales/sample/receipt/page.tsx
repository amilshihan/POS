import { createClient } from "@/lib/supabase/server";
import PrintTrigger from "@/components/pos/PrintTrigger";
import ReceiptView from "@/components/receipt/ReceiptView";

const SAMPLE_SALE = {
  sale_number: "S-000000",
  created_at: new Date().toISOString(),
  subtotal: 45.98,
  discount: 2.0,
  total: 43.98,
  amount_paid: 43.98,
  payment_method: "cash",
  customers: null,
  profiles: { full_name: "Sample Cashier" },
  sale_items: [
    { qty: 2, unit_price: 12.5, line_total: 25.0, parts: { name: "Brake Pad Set", unit: "pcs" } },
    { qty: 1, unit_price: 20.98, line_total: 20.98, parts: { name: "Oil Filter", unit: "pcs" } },
  ],
};

export default async function SampleReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const { print } = await searchParams;
  const supabase = await createClient();
  const { data: settings } = await supabase.from("shop_settings").select("*").single();

  const shopSettings = settings ?? {
    shop_name: "Spare Parts Shop",
    address: null,
    phone: null,
    receipt_width_mm: 80,
    receipt_footer: "Thank you!",
  };

  return (
    <>
      {print === "1" && <PrintTrigger />}
      <ReceiptView sale={SAMPLE_SALE} settings={shopSettings} />
    </>
  );
}
