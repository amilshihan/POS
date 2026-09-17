import { createClient } from "@/lib/supabase/server";
import ServiceTypesClient from "@/components/workshop/ServiceTypesClient";

export default async function ServiceTypesPage() {
  const supabase = await createClient();
  const { data: serviceTypes } = await supabase.from("service_types").select("*").order("name");

  return <ServiceTypesClient initialServiceTypes={serviceTypes ?? []} />;
}
