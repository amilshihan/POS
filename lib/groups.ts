import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryRow = { id: string; name: string; parent_id: string | null };

// Resolves a "/"-separated group path (e.g. "Products/Oil/Castrol") to the id
// of its leaf category, creating any missing segments along the way.
// `working` is mutated in place so repeated calls within one batch (e.g. a
// CSV import) reuse groups created earlier in the same batch.
export async function resolveOrCreateGroupPath(
  supabase: SupabaseClient,
  working: CategoryRow[],
  fullPath: string
): Promise<{ id: string | null; error?: string }> {
  const segments = fullPath
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return { id: null };

  let parentId: string | null = null;
  let leafId: string | null = null;

  for (const segment of segments) {
    const existing = working.find((c) => c.name === segment && (c.parent_id ?? null) === parentId);
    if (existing) {
      parentId = existing.id;
      leafId = existing.id;
      continue;
    }
    const { data, error }: { data: CategoryRow | null; error: { message: string } | null } = await supabase
      .from("categories")
      .insert({ name: segment, parent_id: parentId })
      .select()
      .single();
    if (error || !data) {
      return { id: null, error: error?.message ?? "Could not create group." };
    }
    working.push(data);
    parentId = data.id;
    leafId = data.id;
  }
  return { id: leafId };
}

export type SupplierRow = { id: string; name: string };

// Finds a supplier by case-insensitive name, creating it if it doesn't exist.
export async function resolveOrCreateSupplier(
  supabase: SupabaseClient,
  working: SupplierRow[],
  name: string
): Promise<{ id: string | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { id: null };

  const existing = working.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { id: existing.id };

  const { data, error }: { data: SupplierRow | null; error: { message: string } | null } = await supabase
    .from("suppliers")
    .insert({ name: trimmed })
    .select()
    .single();
  if (error || !data) {
    return { id: null, error: error?.message ?? "Could not create supplier." };
  }
  working.push(data);
  return { id: data.id };
}
