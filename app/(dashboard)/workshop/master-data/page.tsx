import { createClient } from "@/lib/supabase/server";
import VehicleMasterDataClient from "@/components/workshop/VehicleMasterDataClient";

export default async function VehicleMasterDataPage() {
  const supabase = await createClient();
  const [brandsRes, modelsRes] = await Promise.all([
    supabase.from("vehicle_brands").select("*").order("name"),
    supabase.from("vehicle_models").select("*, vehicle_brands(name)").order("name"),
  ]);

  return <VehicleMasterDataClient initialBrands={brandsRes.data ?? []} initialModels={modelsRes.data ?? []} />;
}
