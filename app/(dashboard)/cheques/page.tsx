import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import ChequesClient from "@/components/cheques/ChequesClient";

export default async function ChequesPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();

  const [chequesRes, customersRes, suppliersRes] = await Promise.all([
    supabase
      .from("cheques")
      .select("*, customers(name), suppliers(name)")
      .order("due_date"),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  return (
    <ChequesClient
      initialCheques={chequesRes.data ?? []}
      customers={customersRes.data ?? []}
      suppliers={suppliersRes.data ?? []}
      createdBy={profile?.id ?? ""}
    />
  );
}
