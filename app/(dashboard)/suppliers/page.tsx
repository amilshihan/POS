import { createClient } from "@/lib/supabase/server";
import SuppliersClient from "@/components/suppliers/SuppliersClient";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");

  return <SuppliersClient initialSuppliers={suppliers ?? []} />;
}
