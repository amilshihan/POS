import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, usernameToEmail } from "@/lib/staffAuth";

// Admin-only: changes how a staff member logs in — either their username
// (which re-derives their synthetic login email automatically) or a real
// email address directly. Staff can't change this themselves (see
// components/profile/ProfileClient.tsx).
export async function POST(request: Request) {
  const { profile } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Only admins can change a login username or email." }, { status: 403 });
  }

  const { userId, username, email } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing user." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (username) {
    const normalizedUsername = normalizeUsername(username);
    if (normalizedUsername.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters (letters, numbers, dots, dashes)." },
        { status: 400 }
      );
    }
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .neq("id", userId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: usernameToEmail(normalizedUsername),
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    const { error: profileError } = await admin
      .from("profiles")
      .update({ username: normalizedUsername })
      .eq("id", userId);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, username: normalizedUsername });
  }

  if (email) {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: trimmedEmail });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    // Switching to a real email means they're no longer username-based.
    const { error: profileError } = await admin.from("profiles").update({ username: null }).eq("id", userId);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, email: trimmedEmail });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
