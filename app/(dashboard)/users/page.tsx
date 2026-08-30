import { createClient } from "@/lib/supabase/server";
import UsersClient from "@/components/users/UsersClient";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: staff } = await supabase.from("profiles").select("*").order("full_name");

  return <UsersClient initialStaff={staff ?? []} />;
}
