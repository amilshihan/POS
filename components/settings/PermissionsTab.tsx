"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_MENU_ITEMS, type MenuSection } from "@/lib/menuItems";

type RoleRow = { name: string; label: string; is_system: boolean };
type PermRow = { role: string; path: string; enabled: boolean };

const SECTION_LABEL: Record<MenuSection, string> = {
  cashier: "Main Menu",
  workshop: "Workshop",
  admin: "Admin",
};

function isAlwaysOn(role: string, href: string): boolean {
  if (href === "/dashboard" || href === "/profile") return true;
  if (href === "/settings" && role === "admin") return true;
  return false;
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function PermissionsTab({
  initialRoles,
  initialPermissions,
}: {
  initialRoles: RoleRow[];
  initialPermissions: PermRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles);
  const [rows, setRows] = useState<PermRow[]>(initialPermissions);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  function isEnabled(role: string, href: string): boolean {
    const row = rows.find((r) => r.role === role && r.path === href);
    return row ? row.enabled : true;
  }

  async function toggle(role: string, href: string) {
    if (isAlwaysOn(role, href)) return;
    const key = `${role}:${href}`;
    const nextEnabled = !isEnabled(role, href);
    setSaving(key);
    setError(null);
    const { error: upsertError } = await supabase
      .from("menu_permissions")
      .upsert({ role, path: href, enabled: nextEnabled }, { onConflict: "role,path" });
    setSaving(null);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.role === role && r.path === href);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], enabled: nextEnabled };
        return copy;
      }
      return [...prev, { role, path: href, enabled: nextEnabled }];
    });
    router.refresh();
  }

  async function handleAddRole() {
    setError(null);
    const label = newRoleLabel.trim();
    if (!label) {
      setError("Enter a name for the new role.");
      return;
    }
    const name = slugify(label);
    if (!name) {
      setError("That role name isn't usable — try adding some letters.");
      return;
    }
    if (roles.some((r) => r.name === name)) {
      setError("A role with that name already exists.");
      return;
    }
    setAddingRole(true);
    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .insert({ name, label, is_system: false })
      .select()
      .single();
    if (roleError || !roleData) {
      setAddingRole(false);
      setError(roleError?.message ?? "Could not create the role.");
      return;
    }

    // New roles start like Cashier: able to see the main menu and workshop,
    // but every Admin-section page is off until explicitly turned on here.
    const adminItems = ALL_MENU_ITEMS.filter((item) => item.section === "admin");
    const defaultRows = adminItems.map((item) => ({ role: name, path: item.href, enabled: false }));
    const { error: permError } = await supabase.from("menu_permissions").insert(defaultRows);
    setAddingRole(false);
    if (permError) {
      setError(permError.message);
      return;
    }

    setRoles((prev) => [...prev, roleData]);
    setRows((prev) => [...prev, ...defaultRows]);
    setNewRoleLabel("");
    router.refresh();
  }

  async function handleDeleteRole(role: RoleRow) {
    if (role.is_system) return;
    if (!window.confirm(`Delete the "${role.label}" role? Any staff still assigned to it must be moved first.`)) {
      return;
    }
    setError(null);
    const { error: deleteError } = await supabase.from("roles").delete().eq("name", role.name);
    if (deleteError) {
      setError(
        deleteError.code === "23503"
          ? `Can't delete "${role.label}" — one or more staff members still have this role. Change their role first.`
          : deleteError.message
      );
      return;
    }
    setRoles((prev) => prev.filter((r) => r.name !== role.name));
    setRows((prev) => prev.filter((r) => r.role !== role.name));
    router.refresh();
  }

  const sections: MenuSection[] = ["cashier", "workshop", "admin"];
  const orderedRoles = [...roles].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Turn menu items on or off per role. A staff member whose item is off can&apos;t open that
        page either, even by typing the URL directly — not just hide it from the sidebar.
      </p>
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <div
          className="grid items-center bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2"
          style={{ gridTemplateColumns: `1fr repeat(${orderedRoles.length}, 100px)` }}
        >
          <div>Menu Item</div>
          {orderedRoles.map((role) => (
            <div key={role.name} className="text-center flex flex-col items-center gap-1">
              <span>{role.label}</span>
              {!role.is_system && (
                <button
                  type="button"
                  onClick={() => handleDeleteRole(role)}
                  className="text-[10px] font-normal text-red-500 hover:underline normal-case"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {sections.map((section) => (
            <div key={section}>
              <div className="px-3 py-1.5 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {SECTION_LABEL[section]}
              </div>
              {ALL_MENU_ITEMS.filter((item) => item.section === section).map((item) => (
                <div
                  key={item.href}
                  className="grid items-center px-3 py-2 border-t border-slate-50"
                  style={{ gridTemplateColumns: `1fr repeat(${orderedRoles.length}, 100px)` }}
                >
                  <div className="text-sm text-slate-700">{item.label}</div>
                  {orderedRoles.map((role) => {
                    const alwaysOn = isAlwaysOn(role.name, item.href);
                    const enabled = isEnabled(role.name, item.href);
                    const key = `${role.name}:${item.href}`;
                    return (
                      <div key={role.name} className="flex justify-center">
                        {alwaysOn ? (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">Always on</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={saving === key}
                            onChange={() => toggle(role.name, item.href)}
                            className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="text-sm font-semibold text-slate-700">Add a role</div>
        <p className="text-xs text-slate-500">
          New roles start able to see the Main Menu and Workshop, with Admin-section pages off —
          turn specific ones on above.
        </p>
        <div className="flex gap-2">
          <input
            value={newRoleLabel}
            onChange={(e) => setNewRoleLabel(e.target.value)}
            placeholder="e.g. Workshop Manager"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddRole}
            disabled={addingRole}
            className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {addingRole ? "Adding..." : "+ Add Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
