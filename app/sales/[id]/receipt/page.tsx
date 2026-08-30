import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintTrigger from "@/components/pos/PrintTrigger";

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
  const settings = settingsRes.data ?? { shop_name: "Spare Parts Shop", address: null, phone: null, receipt_width_mm: 80 };

  const widthMm = settings.receipt_width_mm ?? 80;

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-8 print:bg-white print:py-0">
      <PrintTrigger />
      <div
        id="receipt"
        className="bg-white shadow-sm print:shadow-none font-mono text-[12px] leading-tight"
        style={{ width: `${widthMm}mm`, padding: "6mm" }}
      >
        <div className="text-center mb-2">
          <div className="font-bold text-sm">{settings.shop_name}</div>
          {settings.address && <div>{settings.address}</div>}
          {settings.phone && <div>{settings.phone}</div>}
        </div>
        <div className="border-t border-dashed border-black my-2" />
        <div>Receipt: {sale.sale_number}</div>
        <div>Date: {new Date(sale.created_at).toLocaleString()}</div>
        <div>Cashier: {sale.profiles?.full_name ?? "-"}</div>
        {sale.customers && <div>Customer: {sale.customers.name}</div>}
        <div className="border-t border-dashed border-black my-2" />
        {sale.sale_items.map((item, i) => (
          <div key={i} className="mb-1">
            <div>{item.parts.name}</div>
            <div className="flex justify-between">
              <span>
                {item.qty} {item.parts.unit} x ${item.unit_price.toFixed(2)}
              </span>
              <span>${item.line_total.toFixed(2)}</span>
            </div>
          </div>
        ))}
        <div className="border-t border-dashed border-black my-2" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${sale.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-${sale.discount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm">
          <span>Total</span>
          <span>${sale.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid ({sale.payment_method})</span>
          <span>${sale.amount_paid.toFixed(2)}</span>
        </div>
        {sale.amount_paid < sale.total && (
          <div className="flex justify-between font-bold">
            <span>Balance Due</span>
            <span>${(sale.total - sale.amount_paid).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-dashed border-black my-2" />
        <div className="text-center">Thank you!</div>
      </div>

      <style>{`
        @media print {
          @page { size: ${widthMm}mm auto; margin: 0; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
