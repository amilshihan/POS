"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  phone: string | null;
  nic_no: string | null;
  username: string | null;
  must_change_password: boolean;
};

export default function ProfileClient({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [details, setDetails] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    nic_no: profile?.nic_no ?? "",
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleSaveDetails() {
    setDetailsError(null);
    setDetailsSaved(false);
    if (!details.full_name.trim()) {
      setDetailsError("Name can't be empty.");
      return;
    }
    setDetailsSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setDetailsSaving(false);
      setDetailsError("Not signed in.");
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: details.full_name.trim(),
        phone: details.phone.trim() || null,
        nic_no: details.nic_no.trim() || null,
      })
      .eq("id", uid);
    setDetailsSaving(false);
    if (updateError) {
      setDetailsError(updateError.message);
      return;
    }
    setDetailsSaved(true);
    router.refresh();
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordSaving(false);
      setPasswordError(error.message);
      return;
    }
    if (profile?.must_change_password) {
      await supabase.rpc("clear_must_change_password");
      setPasswordSaving(false);
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setPasswordSaving(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated.");
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>

      {profile?.must_change_password && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
          Please set a new password below to continue.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Details</h2>
        {detailsError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{detailsError}</div>}
        {profile?.username && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              value={profile.username}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-400">Only an admin can change your username or login email.</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          <input
            value={details.full_name}
            onChange={(e) => setDetails({ ...details, full_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mobile No</label>
          <input
            value={details.phone}
            onChange={(e) => setDetails({ ...details, phone: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">NIC No</label>
          <input
            value={details.nic_no}
            onChange={(e) => setDetails({ ...details, nic_no: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        {detailsSaved && <div className="text-sm text-green-600">Saved.</div>}
        <button
          onClick={handleSaveDetails}
          disabled={detailsSaving}
          className="rounded-lg bg-blue-600 text-white font-medium px-5 py-2.5 hover:bg-blue-700 disabled:opacity-60"
        >
          {detailsSaving ? "Saving..." : "Save Details"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Password</h2>
        {passwordError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{passwordError}</div>}
        {passwordMessage && (
          <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">{passwordMessage}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            autoComplete="new-password"
          />
        </div>
        <button
          onClick={handleChangePassword}
          disabled={passwordSaving}
          className="rounded-lg bg-blue-600 text-white font-medium px-5 py-2.5 hover:bg-blue-700 disabled:opacity-60"
        >
          {passwordSaving ? "Saving..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
