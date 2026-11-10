import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10): string {
  let pwd = "";
  for (let i = 0; i < length; i++) pwd += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  return pwd;
}

export async function POST(request: Request) {
  const { profile } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Only admins can reset passwords." }, { status: 403 });
  }

  const { userId, password } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing user." }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("username, full_name")
    .eq("id", userId)
    .single();
  if (!targetProfile) {
    return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  }

  const tempPassword = password || generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  return NextResponse.json({ ok: true, username: targetProfile.username, tempPassword });
}
