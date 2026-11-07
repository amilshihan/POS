import { createClient } from "@/lib/supabase/server";
import CustomersClient from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: paymentTypes }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("payment_types").select("id, name, kind").eq("is_active", true).order("sort_order"),
  ]);

  return <CustomersClient initialCustomers={customers ?? []} paymentTypes={paymentTypes ?? []} />;
}
