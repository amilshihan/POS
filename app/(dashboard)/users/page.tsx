import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UsersClient from "@/components/users/UsersClient";

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: staff }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("roles").select("name, label, is_system").order("is_system", { ascending: false }),
  ]);

  const admin = createAdminClient();
  const staffWithEmail = await Promise.all(
    (staff ?? []).map(async (s) => {
      const { data } = await admin.auth.admin.getUserById(s.id);
      return { ...s, email: data.user?.email ?? "" };
    })
  );

  return <UsersClient initialStaff={staffWithEmail} roles={roles ?? []} />;
}
