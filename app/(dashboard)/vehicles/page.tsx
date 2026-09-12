import { createClient } from "@/lib/supabase/server";
import VehiclesClient from "@/components/vehicles/VehiclesClient";

export default async function VehiclesPage() {
  const supabase = await createClient();
  const [vehiclesRes, customersRes, brandsRes, modelsRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*, customers(customer_code, name), vehicle_brands(name), vehicle_models(name)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, customer_code, name").order("name"),
    supabase.from("vehicle_brands").select("*").order("name"),
    supabase.from("vehicle_models").select("*").order("name"),
  ]);

  return (
    <VehiclesClient
      initialVehicles={vehiclesRes.data ?? []}
      customers={customersRes.data ?? []}
      brands={brandsRes.data ?? []}
      models={modelsRes.data ?? []}
    />
  );
}
