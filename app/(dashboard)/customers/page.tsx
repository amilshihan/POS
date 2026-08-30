import { createClient } from "@/lib/supabase/server";
import CustomersClient from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  return <CustomersClient initialCustomers={customers ?? []} />;
}
