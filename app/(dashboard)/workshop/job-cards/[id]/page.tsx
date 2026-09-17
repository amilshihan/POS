import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JobCardDetailClient from "@/components/workshop/JobCardDetailClient";

export default async function JobCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [jobCardRes, servicesRes, partsRes, serviceTypesRes, mechanicsRes, productsRes] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "*, customers(id, customer_code, name, phone, email, address, credit_limit), vehicles(id, vehicle_number, year, engine_number, chassis_number, notes, vehicle_brands(name), vehicle_models(name)), mechanic:profiles!job_cards_mechanic_id_fkey(id, full_name)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("job_card_services")
      .select("*, service_types(name), performed_by_profile:profiles!job_card_services_performed_by_fkey(full_name)")
      .eq("job_card_id", id)
      .order("created_at"),
    supabase
      .from("job_card_parts")
      .select("*, parts(sku, name)")
      .eq("job_card_id", id)
      .order("created_at"),
    supabase.from("service_types").select("*").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("parts").select("id, sku, name, sell_price, qty_on_hand").eq("is_active", true).order("name"),
  ]);

  if (jobCardRes.error || !jobCardRes.data) {
    notFound();
  }

  return (
    <JobCardDetailClient
      jobCard={jobCardRes.data}
      services={servicesRes.data ?? []}
      parts={partsRes.data ?? []}
      serviceTypes={serviceTypesRes.data ?? []}
      mechanics={mechanicsRes.data ?? []}
      products={productsRes.data ?? []}
    />
  );
}
