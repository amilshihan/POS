import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import SignOutButton from "@/components/ui/SignOutButton";
import NavLinks from "@/components/ui/NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    redirect("/login");
  }

  const admin = isAdmin(profile);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="font-bold text-white text-lg">Spare Parts POS</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {profile?.full_name ?? user.email} · {admin ? "Admin" : "Cashier"}
          </div>
        </div>
        <NavLinks admin={admin} />
        <div className="mt-auto p-4 border-t border-slate-800">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
