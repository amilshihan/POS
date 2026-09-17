import { createClient } from "@/lib/supabase/server";
import JobCardsClient from "@/components/workshop/JobCardsClient";

export default async function JobCardsPage() {
  const supabase = await createClient();
  const [jobCardsRes, customersRes, vehiclesRes, profilesRes, brandsRes, modelsRes] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "*, customers(customer_code, name, phone), vehicles(vehicle_number), mechanic:profiles!job_cards_mechanic_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, customer_code, name").order("name"),
    supabase.from("vehicles").select("id, customer_id, vehicle_number").order("vehicle_number"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("vehicle_brands").select("*").eq("is_active", true).order("name"),
    supabase.from("vehicle_models").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <JobCardsClient
      initialJobCards={jobCardsRes.data ?? []}
      customers={customersRes.data ?? []}
      vehicles={vehiclesRes.data ?? []}
      mechanics={profilesRes.data ?? []}
      brands={brandsRes.data ?? []}
      models={modelsRes.data ?? []}
    />
  );
}
