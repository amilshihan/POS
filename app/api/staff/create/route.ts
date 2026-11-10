import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/staffAuth";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10): string {
  let pwd = "";
  for (let i = 0; i < length; i++) pwd += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  return pwd;
}

export async function POST(request: Request) {
  const { profile } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Only admins can add staff." }, { status: 403 });
  }

  const { fullName, username, nicNo, mobile, role } = await request.json();
  if (!fullName || !username) {
    return NextResponse.json({ error: "Name and username are required." }, { status: 400 });
  }

  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters (letters, numbers, dots, dashes)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
  }

  const { data: roleRow } = await admin.from("roles").select("name").eq("name", role).maybeSingle();
  const finalRole = roleRow?.name ?? "cashier";

  const tempPassword = generateTempPassword();
  const email = usernameToEmail(normalizedUsername);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not create the staff account." }, { status: 400 });
  }

  // The DB trigger `handle_new_user` already created a profile row with role 'cashier' —
  // fill in the rest here.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      role: finalRole,
      username: normalizedUsername,
      nic_no: nicNo || null,
      phone: mobile || null,
      must_change_password: true,
    })
    .eq("id", data.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, username: normalizedUsername, tempPassword });
}
