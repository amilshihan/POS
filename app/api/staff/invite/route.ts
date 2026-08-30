import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { profile } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Only admins can invite staff." }, { status: 403 });
  }

  const { email, fullName, role } = await request.json();
  if (!email || !fullName) {
    return NextResponse.json({ error: "Email and name are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not invite user." }, { status: 400 });
  }

  // The DB trigger `handle_new_user` already created a profile row with role 'cashier' —
  // update it here with the chosen name/role.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role: role === "admin" ? "admin" : "cashier" })
    .eq("id", data.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
