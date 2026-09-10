"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveOrCreateGroupPath, resolveOrCreateSupplier } from "@/lib/groups";
import { buildCsv, parseCsv, rowsToObjects, toBool, toNumOrNull, toNumOrZero } from "@/lib/csv";

type Category = { id: string; name: string; parent_id: string | null };
type Supplier = { id: string; name: string };
type Tax = { id: string; name: string; rate_percent: number; is_default: boolean };
type SortColumn = "name" | "group" | "barcode" | "cost" | "price" | "stock";
type TextFilterColumn = "name" | "group" | "barcode";
type RangeFilterColumn = "cost" | "price" | "stock";

const COLUMN_LABELS: Record<SortColumn, string> = {
  name: "Name",
  group: "Product Group",
  barcode: "Barcode",
  cost: "Cost",
  price: "Price",
  stock: "Stock",
};

type GroupOption = { id: string; path: string };

function buildGroupPaths(categories: Category[]): GroupOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  function pathFor(id: string, seen: Set<string> = new Set()): string {
    if (seen.has(id)) return "?";
    seen.add(id);
    const c = byId.get(id);
    if (!c) return "?";
    return c.parent_id ? `${pathFor(c.parent_id, seen)}/${c.name}` : c.name;
  }
  return categories.map((c) => ({ id: c.id, path: pathFor(c.id) })).sort((a, b) => a.path.localeCompare(b.path));
}

function GroupPicker({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "No group",
}: {
  options: GroupOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = query ? options.filter((o) => o.path.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div className="relative">
      <input
        value={open ? query : (selected?.path ?? "")}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
          {onCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCreate}
              className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-slate-100"
            >
              + New group…
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-sm ${
              !value ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            No group
            {!value && <span>✓</span>}
          </button>
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-sm ${
                value === o.id ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              {o.path}
              {value === o.id && <span>✓</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No matching groups</div>}
        </div>
      )}
    </div>
  );
}

type Part = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  cost_price?: number;
  sell_price: number;
  retail_price: number;
  markup_percent: number | null;
  tax_id: string | null;
  is_tax_inclusive_price: boolean;
  is_price_change_allowed: boolean;
  is_using_default_quantity: boolean;
  is_service: boolean;
  is_drum: boolean;
  pack_size: string | null;
  drum_measurement: string | null;
  supplier_id?: string | null;
  qty_on_hand: number;
  reorder_point?: number | null;
  preferred_quantity?: number | null;
  low_stock_threshold: number;
  low_stock_warning_enabled: boolean;
  unit: string;
  is_active: boolean;
};

type ImportPayload = {
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  cost_price: number;
  markup_percent: number | null;
  retail_price: number;
  sell_price: number;
  tax_id: string | null;
  is_tax_inclusive_price: boolean;
  is_price_change_allowed: boolean;
  is_using_default_quantity: boolean;
  is_service: boolean;
  is_active: boolean;
  qty_on_hand: number;
  supplier_id: string | null;
  reorder_point: number | null;
  preferred_quantity: number | null;
  low_stock_warning_enabled: boolean;
  low_stock_threshold: number;
};

// True if an imported row's values exactly match the existing product, so the
// import can skip writing it instead of re-saving identical data.
function partsEqual(existing: Part, payload: ImportPayload): boolean {
  return (
    (existing.sku ?? null) === payload.sku &&
    (existing.barcode ?? null) === payload.barcode &&
    existing.name === payload.name &&
    (existing.description ?? null) === payload.description &&
    (existing.category_id ?? null) === payload.category_id &&
    existing.unit === payload.unit &&
    (existing.cost_price ?? 0) === payload.cost_price &&
    (existing.markup_percent ?? null) === payload.markup_percent &&
    existing.retail_price === payload.retail_price &&
    existing.sell_price === payload.sell_price &&
    (existing.tax_id ?? null) === payload.tax_id &&
    existing.is_tax_inclusive_price === payload.is_tax_inclusive_price &&
    existing.is_price_change_allowed === payload.is_price_change_allowed &&
    existing.is_using_default_quantity === payload.is_using_default_quantity &&
    existing.is_service === payload.is_service &&
    existing.is_active === payload.is_active &&
    existing.qty_on_hand === payload.qty_on_hand &&
    (existing.supplier_id ?? null) === payload.supplier_id &&
    (existing.reorder_point ?? null) === payload.reorder_point &&
    (existing.preferred_quantity ?? null) === payload.preferred_quantity &&
    existing.low_stock_warning_enabled === payload.low_stock_warning_enabled &&
    existing.low_stock_threshold === payload.low_stock_threshold
  );
}

const CSV_HEADERS = [
  "Name",
  "ProductGroup",
  "SKU",
  "Barcode",
  "MeasurementUnit",
  "Cost",
  "Markup",
  "Retail Price",
  "Price",
  "Tax",
  "IsTaxInclusivePrice",
  "IsPriceChangeAllowed",
  "IsUsingDefaultQuantity",
  "IsService",
  "IsEnabled",
  "Description",
  "Quantity",
  "Supplier",
  "ReorderPoint",
  "PreferredQuantity",
  "LowStockWarning",
  "WarningQuantity",
];

const emptyForm = {
  id: "",
  sku: "",
  barcode: "",
  name: "",
  description: "",
  category_id: "",
  unit: "pcs",
  cost_price: "0",
  retail_price: "0",
  markup_percent: "",
  sell_price: "0",
  tax_id: "",
  is_tax_inclusive_price: false,
  is_price_change_allowed: true,
  is_using_default_quantity: true,
  is_service: false,
  is_drum: false,
  pack_size: "",
  drum_measurement: "",
  is_active: true,
  qty_on_hand: "0",
  supplier_id: "",
  reorder_point: "",
  preferred_quantity: "",
  low_stock_warning_enabled: true,
  low_stock_threshold: "5",
};

export default function InventoryClient({
  initialParts,
  categories,
  suppliers,
  taxes,
  admin,
}: {
  initialParts: Part[];
  categories: Category[];
  suppliers: Supplier[];
  taxes: Tax[];
  admin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const groupOptions = useMemo(() => buildGroupPaths(categories), [categories]);
  const groupPathById = useMemo(() => new Map(groupOptions.map((g) => [g.id, g.path])), [groupOptions]);
  const [promptDialog, setPromptDialog] = useState<{
    title: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; failed: number; errors: string[] } | null>(
    null
  );
  const [busy, setBusy] = useState<{ message: string; current?: number; total?: number } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [colFilters, setColFilters] = useState({
    name: "",
    group: "",
    barcode: "",
    costMin: "",
    costMax: "",
    priceMin: "",
    priceMax: "",
    stockMin: "",
    stockMax: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterColumn, setActiveFilterColumn] = useState<SortColumn | null>(null);

  function getTextFilterValue(col: TextFilterColumn): string {
    return colFilters[col];
  }

  function setTextFilterValue(col: TextFilterColumn, value: string) {
    setColFilters((f) => ({ ...f, [col]: value }));
  }

  function getRangeFilterValue(col: RangeFilterColumn): { min: string; max: string } {
    if (col === "cost") return { min: colFilters.costMin, max: colFilters.costMax };
    if (col === "price") return { min: colFilters.priceMin, max: colFilters.priceMax };
    return { min: colFilters.stockMin, max: colFilters.stockMax };
  }

  function setRangeFilterValue(col: RangeFilterColumn, part: "min" | "max", value: string) {
    setColFilters((f) => {
      if (col === "cost") return part === "min" ? { ...f, costMin: value } : { ...f, costMax: value };
      if (col === "price") return part === "min" ? { ...f, priceMin: value } : { ...f, priceMax: value };
      return part === "min" ? { ...f, stockMin: value } : { ...f, stockMax: value };
    });
  }

  function isColumnFiltered(col: SortColumn): boolean {
    if (col === "name" || col === "group" || col === "barcode") return getTextFilterValue(col).trim() !== "";
    const { min, max } = getRangeFilterValue(col);
    return min !== "" || max !== "";
  }

  function stockDisplay(p: Part): string {
    if (p.is_service) return "—";
    if (p.is_drum) return p.pack_size || "—";
    return `${p.qty_on_hand} ${p.unit}`;
  }

  function columnValue(p: Part, col: SortColumn): string {
    switch (col) {
      case "name":
        return p.name;
      case "group":
        return p.category_id ? (groupPathById.get(p.category_id) ?? "—") : "—";
      case "barcode":
        return p.barcode ?? "";
      case "cost":
        return `$${Number(p.cost_price ?? 0).toFixed(2)}`;
      case "price":
        return `$${p.sell_price.toFixed(2)}`;
      case "stock":
        return stockDisplay(p);
    }
  }

  function renderSortableHeader(col: SortColumn, align: "left" | "right" = "left") {
    const label = COLUMN_LABELS[col];
    return (
      <th
        className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-slate-900 ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggleSort(col)}
      >
        <span className={`inline-flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          {sortIndicator(col)}
          <button
            type="button"
            title={`Filter by ${label.toLowerCase()}`}
            aria-label={`Filter by ${label.toLowerCase()}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveFilterColumn(col);
            }}
            className={`text-slate-400 hover:text-blue-600 ${isColumnFiltered(col) ? "text-blue-600" : ""}`}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
      </th>
    );
  }

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sortColumn !== col) return null;
    return <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  }

  const hasColumnFilters = Object.values(colFilters).some((v) => v.trim() !== "");

  function askText(title: string, defaultValue: string, onSubmit: (value: string) => void) {
    setPromptValue(defaultValue);
    setPromptDialog({ title, onSubmit });
  }

  function askConfirm(
    message: string,
    onConfirm: () => void,
    opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }
  ) {
    setConfirmDialog({
      message,
      onConfirm,
      confirmLabel: opts?.confirmLabel ?? "Delete",
      cancelLabel: opts?.cancelLabel ?? "Cancel",
      danger: opts?.danger ?? true,
    });
  }

  const filtered = useMemo(() => {
    const groupPathOf = (p: Part) => (p.category_id ? (groupPathById.get(p.category_id) ?? "") : "");

    let rows = initialParts.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
    );

    const nameQ = colFilters.name.trim().toLowerCase();
    if (nameQ) rows = rows.filter((p) => p.name.toLowerCase().includes(nameQ));

    const groupQ = colFilters.group.trim().toLowerCase();
    if (groupQ) rows = rows.filter((p) => groupPathOf(p).toLowerCase().includes(groupQ));

    const barcodeQ = colFilters.barcode.trim().toLowerCase();
    if (barcodeQ) rows = rows.filter((p) => (p.barcode ?? "").toLowerCase().includes(barcodeQ));

    if (colFilters.costMin !== "") rows = rows.filter((p) => (p.cost_price ?? 0) >= Number(colFilters.costMin));
    if (colFilters.costMax !== "") rows = rows.filter((p) => (p.cost_price ?? 0) <= Number(colFilters.costMax));
    if (colFilters.priceMin !== "") rows = rows.filter((p) => p.sell_price >= Number(colFilters.priceMin));
    if (colFilters.priceMax !== "") rows = rows.filter((p) => p.sell_price <= Number(colFilters.priceMax));
    if (colFilters.stockMin !== "") rows = rows.filter((p) => p.qty_on_hand >= Number(colFilters.stockMin));
    if (colFilters.stockMax !== "") rows = rows.filter((p) => p.qty_on_hand <= Number(colFilters.stockMax));

    if (sortColumn) {
      rows = [...rows].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        switch (sortColumn) {
          case "name":
            av = a.name.toLowerCase();
            bv = b.name.toLowerCase();
            break;
          case "group":
            av = groupPathOf(a).toLowerCase();
            bv = groupPathOf(b).toLowerCase();
            break;
          case "barcode":
            av = (a.barcode ?? "").toLowerCase();
            bv = (b.barcode ?? "").toLowerCase();
            break;
          case "cost":
            av = a.cost_price ?? 0;
            bv = b.cost_price ?? 0;
            break;
          case "price":
            av = a.sell_price;
            bv = b.sell_price;
            break;
          case "stock":
            av = a.qty_on_hand;
            bv = b.qty_on_hand;
            break;
        }
        if (av < bv) return sortDirection === "asc" ? -1 : 1;
        if (av > bv) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [initialParts, search, colFilters, sortColumn, sortDirection, groupPathById]);

  function nextSku(): string {
    const numericSkus = initialParts
      .map((p) => p.sku)
      .filter((sku): sku is string => !!sku && /^\d+$/.test(sku))
      .map(Number);
    const max = numericSkus.length > 0 ? Math.max(...numericSkus) : 0;
    return String(max + 1);
  }

  function openNew() {
    setForm({ ...emptyForm, sku: nextSku() });
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: Part) {
    setForm({
      id: p.id,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      name: p.name,
      description: p.description ?? "",
      category_id: p.category_id ?? "",
      unit: p.unit,
      cost_price: String(p.cost_price ?? 0),
      retail_price: String(p.retail_price ?? 0),
      markup_percent: p.markup_percent === null ? "" : String(p.markup_percent),
      sell_price: String(p.sell_price),
      tax_id: p.tax_id ?? "",
      is_tax_inclusive_price: p.is_tax_inclusive_price,
      is_price_change_allowed: p.is_price_change_allowed,
      is_using_default_quantity: p.is_using_default_quantity,
      is_service: p.is_service,
      is_drum: p.is_drum,
      pack_size: p.pack_size ?? "",
      drum_measurement: p.drum_measurement ?? "",
      is_active: p.is_active,
      qty_on_hand: String(p.qty_on_hand),
      supplier_id: p.supplier_id ?? "",
      reorder_point: p.reorder_point === null || p.reorder_point === undefined ? "" : String(p.reorder_point),
      preferred_quantity:
        p.preferred_quantity === null || p.preferred_quantity === undefined ? "" : String(p.preferred_quantity),
      low_stock_warning_enabled: p.low_stock_warning_enabled,
      low_stock_threshold: String(p.low_stock_threshold),
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    const dupName = initialParts.find(
      (p) => p.name.trim().toLowerCase() === form.name.trim().toLowerCase() && p.id !== form.id
    );
    if (dupName) {
      askConfirm(
        `The product "${form.name.trim()}" has a duplicate record. Do you want to save the record or skip?`,
        () => performSave(true),
        { confirmLabel: "Save", cancelLabel: "Skip", danger: false }
      );
      return;
    }

    await performSave(false);
  }

  async function performSave(allowSkuAutoFix: boolean) {
    setError(null);
    const trimmedSku = form.sku.trim();
    let skuToUse: string | null = trimmedSku || null;

    if (trimmedSku) {
      const clash = initialParts.find(
        (p) => p.sku?.toLowerCase() === trimmedSku.toLowerCase() && p.id !== form.id
      );
      if (clash) {
        if (!allowSkuAutoFix) {
          setError(`SKU "${trimmedSku}" is already used by "${clash.name}". SKUs must be unique.`);
          return;
        }
        const existingSkus = new Set(initialParts.map((p) => p.sku?.toLowerCase()).filter(Boolean));
        let suffix = 2;
        let candidate = `${trimmedSku}-${suffix}`;
        while (existingSkus.has(candidate.toLowerCase())) {
          suffix++;
          candidate = `${trimmedSku}-${suffix}`;
        }
        skuToUse = candidate;
      }
    }
    setSaving(true);

    const payload = {
      sku: skuToUse,
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      unit: form.unit,
      cost_price: Number(form.cost_price),
      retail_price: Number(form.retail_price),
      markup_percent: form.markup_percent === "" ? null : Number(form.markup_percent),
      sell_price: Number(form.sell_price),
      tax_id: form.tax_id || null,
      is_tax_inclusive_price: form.is_tax_inclusive_price,
      is_price_change_allowed: form.is_price_change_allowed,
      is_using_default_quantity: form.is_using_default_quantity,
      is_service: form.is_service,
      is_drum: form.is_drum,
      pack_size: form.is_drum ? form.pack_size.trim() || null : null,
      drum_measurement: form.is_drum ? form.drum_measurement || null : null,
      is_active: form.is_active,
      qty_on_hand: Number(form.qty_on_hand),
      supplier_id: form.supplier_id || null,
      reorder_point: form.reorder_point === "" ? null : Number(form.reorder_point),
      preferred_quantity: form.preferred_quantity === "" ? null : Number(form.preferred_quantity),
      low_stock_warning_enabled: form.low_stock_warning_enabled,
      low_stock_threshold: Number(form.low_stock_threshold),
    };

    const { error } = form.id
      ? await supabase.from("parts").update(payload).eq("id", form.id)
      : await supabase.from("parts").insert(payload);

    setSaving(false);
    if (error) {
      setError(
        error.code === "23505" && error.message.includes("sku")
          ? `SKU "${trimmedSku}" is already used by another product. SKUs must be unique.`
          : error.message
      );
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function createGroupPath(fullPath: string): Promise<string | null> {
    const working = [...categories];
    const res = await resolveOrCreateGroupPath(supabase, working, fullPath);
    if (res.error) {
      setGroupError(res.error);
      return null;
    }
    return res.id;
  }

  function handleNewGroup(onCreated?: (id: string) => void) {
    askText('New group (use "/" to nest, e.g. "Products/Oil/Castrol")', "", async (path) => {
      if (!path.trim()) return;
      setGroupError(null);
      const leafId = await createGroupPath(path);
      if (leafId) {
        onCreated ? onCreated(leafId) : setGroupId(leafId);
        router.refresh();
      }
    });
  }

  function handleEditGroup() {
    if (!groupId) {
      setGroupError("Select a product group to edit first.");
      return;
    }
    const current = categories.find((c) => c.id === groupId);
    const currentPath = groupOptions.find((o) => o.id === groupId)?.path;
    askText(`Rename group "${currentPath ?? ""}" to:`, current?.name ?? "", async (name) => {
      if (!name.trim()) return;
      setGroupError(null);
      const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", groupId);
      if (error) {
        setGroupError(error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteGroup() {
    if (!groupId) {
      setGroupError("Select a product group to delete first.");
      return;
    }
    const currentPath = groupOptions.find((o) => o.id === groupId)?.path;
    askConfirm(
      `Delete group "${currentPath}"? Its products and any subgroups will become ungrouped/top-level.`,
      async () => {
        setGroupError(null);
        const { error } = await supabase.from("categories").delete().eq("id", groupId);
        if (error) {
          setGroupError(error.message);
          return;
        }
        setGroupId("");
        router.refresh();
      }
    );
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const records = rowsToObjects(headers, rows);

    setBusy({ message: "Importing products, please wait…", current: 0, total: records.length });

    const workingCategories = [...categories];
    const workingSuppliers = [...suppliers];
    const skuMap = new Map<string, Part>(
      initialParts.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p])
    );
    const nameMap = new Map<string, Part>(initialParts.map((p) => [p.name.trim().toLowerCase(), p]));
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      setBusy({ message: "Importing products, please wait…", current: i + 1, total: records.length });
      const r = records[i];
      const rowNum = i + 2; // header is row 1
      const name = r["Name"]?.trim();
      if (!name) {
        skipped++;
        errors.push(`Row ${rowNum}: missing Name, skipped.`);
        continue;
      }

      let categoryId: string | null = null;
      if (r["ProductGroup"]?.trim()) {
        const res = await resolveOrCreateGroupPath(supabase, workingCategories, r["ProductGroup"]);
        if (res.error) {
          errors.push(`Row ${rowNum} (${name}): group "${r["ProductGroup"]}" — ${res.error}`);
          continue;
        }
        categoryId = res.id;
      }

      let supplierId: string | null = null;
      if (r["Supplier"]?.trim()) {
        const res = await resolveOrCreateSupplier(supabase, workingSuppliers, r["Supplier"]);
        if (res.error) {
          errors.push(`Row ${rowNum} (${name}): supplier "${r["Supplier"]}" — ${res.error}`);
          continue;
        }
        supplierId = res.id;
      }

      const taxName = r["Tax"]?.trim();
      const taxId = taxName ? (taxes.find((t) => t.name.toLowerCase() === taxName.toLowerCase())?.id ?? null) : null;
      if (taxName && !taxId) {
        errors.push(`Row ${rowNum} (${name}): tax "${taxName}" not found, left blank.`);
      }

      const payload = {
        name,
        category_id: categoryId,
        sku: r["SKU"]?.trim() || null,
        barcode: r["Barcode"]?.trim() || null,
        unit: r["MeasurementUnit"]?.trim() || "pcs",
        cost_price: toNumOrZero(r["Cost"]),
        markup_percent: toNumOrNull(r["Markup"]),
        retail_price: toNumOrZero(r["Retail Price"]),
        sell_price: toNumOrZero(r["Price"]),
        tax_id: taxId,
        is_tax_inclusive_price: toBool(r["IsTaxInclusivePrice"]),
        is_price_change_allowed: toBool(r["IsPriceChangeAllowed"]),
        is_using_default_quantity: toBool(r["IsUsingDefaultQuantity"]),
        is_service: toBool(r["IsService"]),
        is_active: toBool(r["IsEnabled"]),
        description: r["Description"]?.trim() || null,
        qty_on_hand: toNumOrZero(r["Quantity"]),
        supplier_id: supplierId,
        reorder_point: toNumOrNull(r["ReorderPoint"]),
        preferred_quantity: toNumOrNull(r["PreferredQuantity"]),
        low_stock_warning_enabled: toBool(r["LowStockWarning"]),
        low_stock_threshold: toNumOrZero(r["WarningQuantity"]),
      };

      const matched = payload.sku ? skuMap.get(payload.sku.toLowerCase()) : nameMap.get(name.toLowerCase());

      if (matched) {
        if (partsEqual(matched, payload)) {
          unchanged++;
          continue;
        }
        const { error } = await supabase.from("parts").update(payload).eq("id", matched.id);
        if (error) {
          errors.push(`Row ${rowNum} (${name}): ${error.message}`);
          continue;
        }
        updated++;
        const merged = { ...matched, ...payload };
        if (payload.sku) skuMap.set(payload.sku.toLowerCase(), merged);
        nameMap.set(name.toLowerCase(), merged);
      } else {
        const { data, error } = await supabase.from("parts").insert(payload).select().single();
        if (error) {
          errors.push(`Row ${rowNum} (${name}): ${error.message}`);
          continue;
        }
        created++;
        if (data) {
          if (payload.sku) skuMap.set(payload.sku.toLowerCase(), data as Part);
          nameMap.set(name.toLowerCase(), data as Part);
        }
      }
    }

    setBusy(null);
    setImporting(false);
    setImportResult({ created, updated, unchanged, skipped, errors });
    router.refresh();
  }

  function friendlyDeleteError(name: string, error: { code?: string; message: string }): string {
    if (error.code === "23503") {
      return `Can't delete "${name}" — it has sales or purchase history. Disable it instead (uncheck "Enabled" when editing it).`;
    }
    return `${name}: ${error.message}`;
  }

  function handleDeleteOne(p: Part) {
    askConfirm(`Delete "${p.name}"? This can't be undone.`, async () => {
      setBusy({ message: `Deleting "${p.name}", please wait…` });
      const { error } = await supabase.from("parts").delete().eq("id", p.id);
      setBusy(null);
      if (error) {
        setDeleteResult({ deleted: 0, failed: 1, errors: [friendlyDeleteError(p.name, error)] });
      } else {
        setDeleteResult(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      }
      router.refresh();
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((p) => prev.has(p.id));
      return allSelected ? new Set() : new Set(filtered.map((p) => p.id));
    });
  }

  function handleDeleteSelected() {
    const targets = initialParts.filter((p) => selectedIds.has(p.id));
    if (targets.length === 0) return;
    askConfirm(`Delete ${targets.length} selected product(s)? This can't be undone.`, async () => {
      let deleted = 0;
      const errors: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        setBusy({ message: "Deleting products, please wait…", current: i + 1, total: targets.length });
        const { error } = await supabase.from("parts").delete().eq("id", p.id);
        if (error) {
          errors.push(friendlyDeleteError(p.name, error));
        } else {
          deleted++;
        }
      }
      setBusy(null);
      setDeleteResult({ deleted, failed: errors.length, errors });
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handleExportCsv() {
    const groupPathById = new Map(groupOptions.map((g) => [g.id, g.path]));
    const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));
    const taxNameById = new Map(taxes.map((t) => [t.id, t.name]));

    const rows = initialParts.map((p) => [
      p.name,
      p.category_id ? (groupPathById.get(p.category_id) ?? "") : "",
      p.sku ?? "",
      p.barcode ?? "",
      p.unit,
      p.cost_price ?? 0,
      p.markup_percent ?? "",
      p.retail_price,
      p.sell_price,
      p.tax_id ? (taxNameById.get(p.tax_id) ?? "") : "",
      p.is_tax_inclusive_price ? "1" : "0",
      p.is_price_change_allowed ? "1" : "0",
      p.is_using_default_quantity ? "1" : "0",
      p.is_service ? "1" : "0",
      p.is_active ? "1" : "0",
      p.description ?? "",
      p.qty_on_hand,
      p.supplier_id ? (supplierNameById.get(p.supplier_id) ?? "") : "",
      p.reorder_point ?? "",
      p.preferred_quantity ?? "",
      p.low_stock_warning_enabled ? "1" : "0",
      p.low_stock_threshold,
    ]);

    const csv = buildCsv(CSV_HEADERS, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        {admin && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title={importing ? "Importing products..." : "Import products from a CSV file"}
              aria-label="Import CSV"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M10 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={handleExportCsv}
              title="Export all products to a CSV file"
              aria-label="Export CSV"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M10 4v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={openNew}
              title="Add a new product"
              aria-label="Add Product"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => setShowFilters(true)}
              title="Filter products"
              aria-label="Filter"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z" strokeLinejoin="round" />
              </svg>
              {hasColumnFilters && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {Object.values(colFilters).filter((v) => v.trim() !== "").length}
                </span>
              )}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                title={`Delete ${selectedIds.size} selected product(s)`}
                aria-label="Delete Selected"
                className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                  <path
                    d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {selectedIds.size}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {deleteResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span>
              <span className="text-green-700 font-medium">{deleteResult.deleted} deleted</span>
              {deleteResult.failed > 0 && (
                <>
                  {", "}
                  <span className="text-red-600 font-medium">{deleteResult.failed} failed</span>
                </>
              )}
            </span>
            <button onClick={() => setDeleteResult(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          {deleteResult.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-red-600 list-disc pl-4 space-y-0.5">
              {deleteResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {importResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span>
              <span className="text-green-700 font-medium">{importResult.created} created</span>
              {", "}
              <span className="text-blue-700 font-medium">{importResult.updated} updated</span>
              {", "}
              <span className="text-slate-500 font-medium">{importResult.unchanged} unchanged (skipped)</span>
              {importResult.skipped > 0 && (
                <>
                  {", "}
                  <span className="text-slate-500 font-medium">{importResult.skipped} invalid, skipped</span>
                </>
              )}
              {importResult.errors.length > 0 && (
                <>
                  {", "}
                  <span className="text-red-600 font-medium">{importResult.errors.length} issue(s)</span>
                </>
              )}
            </span>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-red-600 list-disc pl-4 space-y-0.5">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or SKU..."
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2"
      />

      {admin && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 shrink-0">Product Groups</label>
          <div className="w-64">
            <GroupPicker
              options={groupOptions}
              value={groupId}
              onChange={(id) => {
                setGroupId(id);
                setGroupError(null);
              }}
              placeholder="Select a group…"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="New group"
              onClick={() => handleNewGroup()}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path
                  d="M3 5.5A1.5 1.5 0 0 1 4.5 4H8l1.5 1.75H15.5A1.5 1.5 0 0 1 17 7.25v7.25A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z"
                  strokeLinejoin="round"
                />
                <path d="M10 9v4M8 11h4" strokeLinecap="round" />
              </svg>
              New group
            </button>
            <button
              type="button"
              title="Edit group"
              onClick={handleEditGroup}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M13.5 3.5a1.5 1.5 0 0 1 2 2L7 14 4 15l1-3 8.5-8.5Z" strokeLinejoin="round" />
              </svg>
              Edit group
            </button>
            <button
              type="button"
              title="Delete group"
              onClick={handleDeleteGroup}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-600"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path
                  d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete group
            </button>
          </div>
          {groupError && <span className="text-xs text-red-600">{groupError}</span>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {admin && (
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {renderSortableHeader("name")}
              {renderSortableHeader("group")}
              {renderSortableHeader("barcode")}
              {admin && renderSortableHeader("cost", "right")}
              {renderSortableHeader("price", "right")}
              {renderSortableHeader("stock", "right")}
              {admin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr
                key={p.id}
                className={
                  !p.is_service && !p.is_drum && p.low_stock_warning_enabled && p.qty_on_hand <= p.low_stock_threshold
                    ? "bg-red-50"
                    : ""
                }
              >
                {admin && (
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                    />
                  </td>
                )}
                <td className="px-4 py-2 text-slate-800">
                  {p.name}
                  {p.is_service && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1.5 py-0.5">
                      Service
                    </span>
                  )}
                  {!p.is_active && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {p.category_id ? (groupPathById.get(p.category_id) ?? "—") : "—"}
                </td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{p.barcode ?? ""}</td>
                {admin && (
                  <td className="px-4 py-2 text-right text-slate-600">
                    ${Number(p.cost_price ?? 0).toFixed(2)}
                  </td>
                )}
                <td className="px-4 py-2 text-right text-slate-800">${p.sell_price.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-medium">{stockDisplay(p)}</td>
                {admin && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteOne(p)}
                      className="ml-3 text-red-600 hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={admin ? 8 : 5} className="px-4 py-8 text-center text-slate-400">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-20 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-4 my-8 mt-12">
            <h2 className="font-semibold text-lg text-slate-900">
              {form.id ? "Edit Product" : "Add Product"}
            </h2>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

            {/* Basic info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Product Group</label>
                  <GroupPicker
                    options={groupOptions}
                    value={form.category_id}
                    onChange={(id) => setForm({ ...form, category_id: id })}
                    onCreate={() => handleNewGroup((id) => setForm((f) => ({ ...f, category_id: id })))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Measurement Unit</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">SKU</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Barcode</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Cost</label>
                  <input
                    type="number"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Retail Price</label>
                  <input
                    type="number"
                    value={form.retail_price}
                    onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Markup %</label>
                  <input
                    type="number"
                    value={form.markup_percent}
                    onChange={(e) => setForm({ ...form, markup_percent: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Price (POS sell price)</label>
                  <input
                    type="number"
                    value={form.sell_price}
                    onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Tax</label>
                <select
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">No tax</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate_percent}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_tax_inclusive_price}
                    onChange={(e) => setForm({ ...form, is_tax_inclusive_price: e.target.checked })}
                  />
                  Price is tax-inclusive
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_price_change_allowed}
                    onChange={(e) => setForm({ ...form, is_price_change_allowed: e.target.checked })}
                  />
                  Allow price change at POS
                </label>
              </div>
            </div>

            {/* Behavior */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Behavior</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_using_default_quantity}
                    onChange={(e) => setForm({ ...form, is_using_default_quantity: e.target.checked })}
                  />
                  Use default quantity (1) at POS
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_service}
                    onChange={(e) => setForm({ ...form, is_service: e.target.checked })}
                  />
                  This is a service (not stock-tracked)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_drum}
                    onChange={(e) => setForm({ ...form, is_drum: e.target.checked })}
                  />
                  Drum / Bucket
                </label>
              </div>
            </div>

            {/* Stock */}
            {!form.is_service && (
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</h3>
                <div className="grid grid-cols-2 gap-3">
                  {form.is_drum ? (
                    <div>
                      <label className="text-xs text-slate-500">Pack Size</label>
                      <input
                        value={form.pack_size}
                        onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
                        placeholder="e.g. 200L"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-500">Quantity</label>
                      <input
                        type="number"
                        value={form.qty_on_hand}
                        onChange={(e) => setForm({ ...form, qty_on_hand: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-500">Supplier</label>
                    <select
                      value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">No preferred supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.is_drum && (
                  <div>
                    <label className="text-xs text-slate-500">Measurement</label>
                    <select
                      value={form.drum_measurement}
                      onChange={(e) => setForm({ ...form, drum_measurement: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select…</option>
                      <option value="KG">KG</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Reorder Point</label>
                    <input
                      type="number"
                      value={form.reorder_point}
                      onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Preferred Quantity</label>
                    <input
                      type="number"
                      value={form.preferred_quantity}
                      onChange={(e) => setForm({ ...form, preferred_quantity: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.low_stock_warning_enabled}
                      onChange={(e) => setForm({ ...form, low_stock_warning_enabled: e.target.checked })}
                    />
                    Warn on low stock
                  </label>
                  {form.low_stock_warning_enabled && (
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Warning Quantity</label>
                      <input
                        type="number"
                        value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-slate-900">{promptDialog.title}</h3>
            <input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  promptDialog.onSubmit(promptValue);
                  setPromptDialog(null);
                } else if (e.key === "Escape") {
                  setPromptDialog(null);
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPromptDialog(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  promptDialog.onSubmit(promptValue);
                  setPromptDialog(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4">
            <p className="text-sm text-slate-700">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  confirmDialog.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeFilterColumn && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-30 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFilterColumn(null);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-4 my-8 mt-12">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-slate-900">
                Filter by {COLUMN_LABELS[activeFilterColumn]}
              </h2>
              <button onClick={() => setActiveFilterColumn(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {activeFilterColumn === "name" || activeFilterColumn === "group" || activeFilterColumn === "barcode" ? (
              <input
                autoFocus
                value={getTextFilterValue(activeFilterColumn)}
                onChange={(e) => setTextFilterValue(activeFilterColumn, e.target.value)}
                placeholder={`Search ${COLUMN_LABELS[activeFilterColumn].toLowerCase()}…`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={getRangeFilterValue(activeFilterColumn).min}
                  onChange={(e) => setRangeFilterValue(activeFilterColumn, "min", e.target.value)}
                  type="number"
                  placeholder="Min"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={getRangeFilterValue(activeFilterColumn).max}
                  onChange={(e) => setRangeFilterValue(activeFilterColumn, "max", e.target.value)}
                  type="number"
                  placeholder="Max"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th
                      className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-slate-900 ${
                        activeFilterColumn === "cost" || activeFilterColumn === "price" || activeFilterColumn === "stock"
                          ? "text-right"
                          : "text-left"
                      }`}
                      onClick={() => toggleSort(activeFilterColumn)}
                    >
                      {COLUMN_LABELS[activeFilterColumn]}
                      {sortIndicator(activeFilterColumn)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, 200).map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                        />
                      </td>
                      <td
                        className={`px-3 py-1.5 text-slate-800 ${
                          activeFilterColumn === "cost" ||
                          activeFilterColumn === "price" ||
                          activeFilterColumn === "stock"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {columnValue(p, activeFilterColumn)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-slate-400">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400">
              {filtered.length} matching product{filtered.length === 1 ? "" : "s"}
              {filtered.length > 200 ? " (showing first 200)" : ""}
            </p>
          </div>
        </div>
      )}

      {showFilters && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-30 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFilters(false);
          }}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 my-8 mt-12">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-slate-900">Filter Products</h2>
              <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Name</label>
              <input
                value={colFilters.name}
                onChange={(e) => setColFilters((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contains…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Product Group</label>
              <input
                value={colFilters.group}
                onChange={(e) => setColFilters((f) => ({ ...f, group: e.target.value }))}
                placeholder="Contains…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Barcode</label>
              <input
                value={colFilters.barcode}
                onChange={(e) => setColFilters((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Contains…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            {admin && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cost</label>
                <div className="flex gap-2">
                  <input
                    value={colFilters.costMin}
                    onChange={(e) => setColFilters((f) => ({ ...f, costMin: e.target.value }))}
                    type="number"
                    placeholder="Min"
                    className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    value={colFilters.costMax}
                    onChange={(e) => setColFilters((f) => ({ ...f, costMax: e.target.value }))}
                    type="number"
                    placeholder="Max"
                    className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Price</label>
              <div className="flex gap-2">
                <input
                  value={colFilters.priceMin}
                  onChange={(e) => setColFilters((f) => ({ ...f, priceMin: e.target.value }))}
                  type="number"
                  placeholder="Min"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={colFilters.priceMax}
                  onChange={(e) => setColFilters((f) => ({ ...f, priceMax: e.target.value }))}
                  type="number"
                  placeholder="Max"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Stock</label>
              <div className="flex gap-2">
                <input
                  value={colFilters.stockMin}
                  onChange={(e) => setColFilters((f) => ({ ...f, stockMin: e.target.value }))}
                  type="number"
                  placeholder="Min"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  value={colFilters.stockMax}
                  onChange={(e) => setColFilters((f) => ({ ...f, stockMax: e.target.value }))}
                  type="number"
                  placeholder="Max"
                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={!hasColumnFilters}
                onClick={() =>
                  setColFilters({
                    name: "",
                    group: "",
                    barcode: "",
                    costMin: "",
                    costMax: "",
                    priceMin: "",
                    priceMax: "",
                    stockMin: "",
                    stockMax: "",
                  })
                }
                className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-500"
              >
                Clear all filters
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="rounded-lg bg-blue-600 text-white font-medium px-5 py-2 hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-3 text-center">
            <svg className="animate-spin h-6 w-6 text-blue-600 mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700">Please wait — {busy.message}</p>
            {busy.total !== undefined && (
              <>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 transition-all"
                    style={{ width: `${Math.min(100, Math.round(((busy.current ?? 0) / busy.total) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {busy.current ?? 0} / {busy.total}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
