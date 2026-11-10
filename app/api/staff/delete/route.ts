import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { profile, user } = await getCurrentUserAndProfile();
  if (!isAdmin(profile)) {
    return NextResponse.json({ error: "Only admins can delete staff." }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing user." }, { status: 400 });
  }
  if (userId === user?.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    // Business records (sales, purchases, payments...) reference profiles
    // and are never cascade-deleted, so a staff member with history can't
    // be removed outright — deactivating is the correct move for them.
    const isReferenced = /foreign key|violates/i.test(error.message);
    return NextResponse.json(
      {
        error: isReferenced
          ? "Can't delete — this staff member has sales/purchase history. Deactivate the account instead."
          : error.message,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
