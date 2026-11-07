import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import ExpensesClient from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(profile);

  const { data } = await supabase
    .from("expenses")
    .select("id, expense_date, category, description, amount, payment_method, profiles(full_name)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <ExpensesClient
      initialExpenses={(data ?? []) as unknown as Array<{
        id: string;
        expense_date: string;
        category: string;
        description: string | null;
        amount: number;
        payment_method: string;
        profiles: { full_name: string } | null;
      }>}
      admin={admin}
      createdBy={profile?.id ?? ""}
    />
  );
}
