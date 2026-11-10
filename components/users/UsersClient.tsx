"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Pagination, { paginate } from "@/components/ui/Pagination";

type Staff = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  username: string | null;
  nic_no: string | null;
  is_active: boolean;
  email: string;
};
type Role = { name: string; label: string; is_system: boolean };
type Credentials = { username: string; tempPassword: string };

export default function UsersClient({ initialStaff, roles }: { initialStaff: Staff[]; roles: Role[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", username: "", nicNo: "", mobile: "", role: "cashier" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", nic_no: "", username: "", email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Staff | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { totalPages, currentPage, paginated } = paginate(initialStaff, page);

  function openEdit(s: Staff) {
    setEditing(s);
    setEditForm({
      full_name: s.full_name,
      phone: s.phone ?? "",
      nic_no: s.nic_no ?? "",
      username: s.username ?? "",
      email: s.email,
    });
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editForm.full_name.trim()) {
      setEditError("Name can't be empty.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        nic_no: editForm.nic_no.trim() || null,
      })
      .eq("id", editing.id);
    if (updateError) {
      setEditSaving(false);
      setEditError(updateError.message);
      return;
    }

    const usernameChanged = editForm.username.trim() !== (editing.username ?? "");
    const emailChanged = editForm.email.trim() !== editing.email;
    if (usernameChanged || emailChanged) {
      const res = await fetch("/api/staff/update-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editing.id,
          username: usernameChanged ? editForm.username.trim() : undefined,
          email: !usernameChanged && emailChanged ? editForm.email.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditSaving(false);
        setEditError(data.error ?? "Could not update login.");
        return;
      }
    }

    setEditSaving(false);
    setEditing(null);
    router.refresh();
  }

  async function handleAddStaff() {
    setError(null);
    if (!form.fullName || !form.username) {
      setError("Name and username are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add staff member.");
      return;
    }
    setShowForm(false);
    setForm({ fullName: "", username: "", nicNo: "", mobile: "", role: "cashier" });
    setCredentials({ username: data.username, tempPassword: data.tempPassword });
    router.refresh();
  }

  async function toggleActive(s: Staff) {
    await supabase.from("profiles").update({ is_active: !s.is_active }).eq("id", s.id);
    router.refresh();
  }

  async function changeRole(s: Staff, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", s.id);
    router.refresh();
  }

  function openReset(s: Staff) {
    setResetTarget(s);
    setResetPasswordInput("");
    setResetError(null);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (resetPasswordInput && resetPasswordInput.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    setResetSaving(true);
    setResetError(null);
    const res = await fetch("/api/staff/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetTarget.id, password: resetPasswordInput || undefined }),
    });
    const data = await res.json();
    setResetSaving(false);
    if (!res.ok) {
      setResetError(data.error ?? "Could not reset password.");
      return;
    }
    setCredentials({ username: data.username ?? resetTarget.username ?? "", tempPassword: data.tempPassword });
    setResetTarget(null);
    router.refresh();
  }

  async function handleDelete(s: Staff) {
    if (!window.confirm(`Permanently delete ${s.full_name}'s account? This can't be undone.`)) return;
    setBusyId(s.id);
    setError(null);
    const res = await fetch("/api/staff/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Could not delete staff member.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 transition"
        >
          + Add Staff
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Username</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-slate-800">{s.full_name}</td>
                <td className="px-4 py-2 text-slate-500">{s.username ?? "—"}</td>
                <td className="px-4 py-2">
                  <select
                    value={s.role}
                    onChange={(e) => changeRole(s, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.label}
                      </option>
                    ))}
                    {!roles.some((r) => r.name === s.role) && <option value={s.role}>{s.role}</option>}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span className={s.is_active ? "text-green-600" : "text-slate-400"}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                  <button
                    onClick={() => openEdit(s)}
                    disabled={busyId === s.id}
                    className="text-slate-600 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openReset(s)}
                    disabled={busyId === s.id}
                    className="text-slate-600 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    disabled={busyId === s.id}
                    className="text-blue-600 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={busyId === s.id}
                    className="text-red-600 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={initialStaff.length}
          shownCount={paginated.length}
          onPageChange={setPage}
          itemLabel="staff"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Add Staff Member</h2>
            <p className="text-sm text-slate-500">
              A temporary password is generated for them — you&apos;ll see it once, to pass along.
              They&apos;ll be asked to set their own password on first login.
            </p>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
            <input
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Username (for login)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="NIC No"
              value={form.nicNo}
              onChange={(e) => setForm({ ...form, nicNo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Mobile No"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {roles.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Edit {editing.full_name}</h2>
            {editError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{editError}</div>}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username (for login)</label>
              <input
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="Leave blank if they log in with email instead"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Login email</label>
              <input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-400">
                Changing Username regenerates their login email automatically. To switch them to a real
                email instead, clear Username and set this directly.
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Full name</label>
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">NIC No</label>
              <input
                value={editForm.nic_no}
                onChange={(e) => setEditForm({ ...editForm, nic_no: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Mobile No</label>
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Reset Password — {resetTarget.full_name}</h2>
            <p className="text-sm text-slate-500">
              Type a specific password, or leave this blank to auto-generate one. Either way they&apos;ll
              be asked to set their own password the next time they log in.
            </p>
            {resetError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{resetError}</div>}
            <div>
              <label className="block text-xs text-slate-500 mb-1">New password (optional)</label>
              <input
                value={resetPasswordInput}
                onChange={(e) => setResetPasswordInput(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {resetSaving ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {credentials && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-semibold text-lg text-slate-900">Login Details</h2>
            <p className="text-sm text-slate-500">
              Share these with the staff member now — the password won&apos;t be shown again. They&apos;ll
              be asked to set their own password the first time they log in.
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 font-mono text-sm">
              <div>
                <span className="text-slate-400">Username:</span> {credentials.username}
              </div>
              <div>
                <span className="text-slate-400">Temp password:</span> {credentials.tempPassword}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCredentials(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
