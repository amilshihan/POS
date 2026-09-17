"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TITLES, combineTitleName, isValidEmail, isValidName, isValidPhone, splitTitle } from "@/lib/validation";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, combinePhone, splitPhone } from "@/lib/countries";
import {
  modalTitle,
  fieldLabel,
  helperText,
  requiredMark,
  inputBase,
  inputWithIcon,
  iconLeft,
  iconLeftTop,
  btnPrimary,
  btnSecondary,
  iconActionBtn,
  iconActionBtnDanger,
  cardSurface,
  twoColRow,
} from "@/lib/ui";

type Customer = {
  id: string;
  customer_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  nic: string | null;
  company_name: string | null;
  email: string | null;
  tax_number: string | null;
  city: string | null;
  is_active: boolean;
  credit_limit: number;
  credit_period_days: number;
  credit_balance: number;
  guarantor_name: string | null;
  guarantor_nic: string | null;
  guarantor_mobile: string | null;
};

const PAGE_SIZE = 20;

function FieldIcon({ path, className }: { path: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {path}
    </svg>
  );
}

const IconUserPlus = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="8" cy="7" r="3" />
        <path d="M2.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
        <path d="M16 6v4M14 8h4" strokeLinecap="round" />
      </>
    }
  />
);
const IconUser = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="10" cy="6.5" r="3" />
        <path d="M3.5 17c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" strokeLinecap="round" />
      </>
    }
  />
);
const IconGlobe = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M3 10h14M10 3c2.2 2 3.3 4.4 3.3 7s-1.1 5-3.3 7c-2.2-2-3.3-4.4-3.3-7s1.1-5 3.3-7Z" />
      </>
    }
  />
);
const IconPhone = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <path
        d="M4 3.5h2.5L8 7l-1.7 1.3a8 8 0 0 0 5.4 5.4L13 12l3.5 1.5V16a1.5 1.5 0 0 1-1.6 1.5A13 13 0 0 1 3 5.6 1.5 1.5 0 0 1 4 3.5Z"
        strokeLinejoin="round"
      />
    }
  />
);
const IconIdCard = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
        <circle cx="7" cy="10" r="1.6" />
        <path d="M5.3 13.5c.3-1.1 1.3-1.8 1.7-1.8s1.4.7 1.7 1.8M11.5 8h4M11.5 11h4" strokeLinecap="round" />
      </>
    }
  />
);
const IconBuilding = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <rect x="4" y="2.5" width="9" height="15" rx="1" />
        <path d="M6.5 5.5h1M9.5 5.5h1M6.5 8.5h1M9.5 8.5h1M6.5 11.5h1M9.5 11.5h1M7.5 17.5V15h2v2.5" strokeLinecap="round" />
      </>
    }
  />
);
const IconMail = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
        <path d="M3 5.5 10 11l7-5.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    }
  />
);
const IconMapPin = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <path d="M10 17.5S15.5 12.4 15.5 8.5a5.5 5.5 0 1 0-11 0c0 3.9 5.5 9 5.5 9Z" strokeLinejoin="round" />
        <circle cx="10" cy="8.5" r="2" />
      </>
    }
  />
);
const IconFileText = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <path d="M5 2.5h7l3 3V17a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 17V2.5Z" strokeLinejoin="round" />
        <path d="M7 10h6M7 13h6" strokeLinecap="round" />
      </>
    }
  />
);
const IconUsers = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="7.5" cy="7" r="2.7" />
        <path d="M2 17c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" strokeLinecap="round" />
        <circle cx="14" cy="7.5" r="2.2" />
        <path d="M13 12.3c2.4.4 4 2.2 4 4.7" strokeLinecap="round" />
      </>
    }
  />
);
const IconCoins = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <ellipse cx="7.5" cy="6" rx="4.5" ry="2.3" />
        <path d="M3 6v3.5c0 1.3 2 2.3 4.5 2.3s4.5-1 4.5-2.3V6" strokeLinecap="round" />
        <path d="M3 9.5V13c0 1.3 2 2.3 4.5 2.3s4.5-1 4.5-2.3V9.5" strokeLinecap="round" />
        <ellipse cx="13.5" cy="10.5" rx="4" ry="2" />
        <path d="M9.5 10.5v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3" strokeLinecap="round" />
      </>
    }
  />
);
const IconShield = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <path d="M10 2.5 16 5v5c0 4.2-2.7 7-6 8-3.3-1-6-3.8-6-8V5l6-2.5Z" strokeLinejoin="round" />
        <path d="M7.3 9.7 9.2 11.6 12.9 7.9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    }
  />
);
const IconInfo = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 9v4.5" strokeLinecap="round" />
        <circle cx="10" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
      </>
    }
  />
);
const IconCalendar = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <rect x="3" y="4" width="14" height="13" rx="1.5" />
        <path d="M3 8h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
      </>
    }
  />
);
const IconChevronDown = ({ className }: { className?: string }) => (
  <FieldIcon className={className} path={<path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />} />
);
const IconSave = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <path d="M4 3h9l3.5 3.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
        <path d="M6.5 3v4.5h6V3M6.5 17v-5h7v5" strokeLinejoin="round" />
      </>
    }
  />
);
const IconPlus = ({ className }: { className?: string }) => (
  <FieldIcon className={className} path={<path d="M10 4v12M4 10h12" strokeLinecap="round" />} />
);
const IconTrash = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path
      d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.02A1.5 1.5 0 0 1 11.9 16.5h-3.8a1.5 1.5 0 0 1-1.5-1.48L6 6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IconFilters = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
        <circle cx="7" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="13" cy="10" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" />
      </>
    }
  />
);
const IconSearch = ({ className }: { className?: string }) => (
  <FieldIcon
    className={className}
    path={
      <>
        <circle cx="9" cy="9" r="6" />
        <path d="M17 17l-3.5-3.5" strokeLinecap="round" />
      </>
    }
  />
);
const IconPencil = ({ className }: { className?: string }) => (
  <FieldIcon className={className} path={<path d="M13.5 3.5l3 3L6 17H3v-3L13.5 3.5Z" strokeLinejoin="round" />} />
);

export default function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: "",
    title: "",
    name: "",
    phoneCountry: DEFAULT_COUNTRY_CODE,
    phone: "",
    address: "",
    nic: "",
    company_name: "",
    email: "",
    tax_number: "",
    city: "",
    is_active: true,
    credit_limit: "0",
    credit_period_days: "0",
    guarantor_name: "",
    guarantor_nic: "",
    guarantor_mobile: "",
  });
  const [showCreditSection, setShowCreditSection] = useState(false);
  const [showGuarantorSection, setShowGuarantorSection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; failed: number; errors: string[] } | null>(
    null
  );
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const filtered = initialCustomers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.customer_code.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? c.is_active : !c.is_active);
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  function openNew() {
    setForm({
      id: "",
      title: "",
      name: "",
      phoneCountry: DEFAULT_COUNTRY_CODE,
      phone: "",
      address: "",
      nic: "",
      company_name: "",
      email: "",
      tax_number: "",
      city: "",
      is_active: true,
      credit_limit: "0",
      credit_period_days: "0",
      guarantor_name: "",
      guarantor_nic: "",
      guarantor_mobile: "",
    });
    setShowCreditSection(false);
    setShowGuarantorSection(false);
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    const { country, local } = splitPhone(c.phone);
    const { title, name } = splitTitle(c.name);
    setForm({
      id: c.id,
      title,
      name,
      phoneCountry: country,
      phone: local,
      address: c.address ?? "",
      nic: c.nic ?? "",
      company_name: c.company_name ?? "",
      email: c.email ?? "",
      tax_number: c.tax_number ?? "",
      city: c.city ?? "",
      is_active: c.is_active,
      credit_limit: String(c.credit_limit),
      credit_period_days: String(c.credit_period_days ?? 0),
      guarantor_name: c.guarantor_name ?? "",
      guarantor_nic: c.guarantor_nic ?? "",
      guarantor_mobile: c.guarantor_mobile ?? "",
    });
    setShowCreditSection(c.credit_limit > 0 || c.credit_period_days > 0);
    setShowGuarantorSection(Boolean(c.guarantor_name || c.guarantor_nic || c.guarantor_mobile));
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!isValidName(form.name)) {
      setAlertMessage("The name you have entered is incorrect.");
      return;
    }
    const fullPhone = combinePhone(form.phoneCountry, form.phone);
    if (fullPhone && !isValidPhone(fullPhone)) {
      setAlertMessage("The mobile number you have entered is incorrect.");
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      setAlertMessage("The email address you have entered is incorrect.");
      return;
    }
    if (form.guarantor_mobile.trim() && !isValidPhone(form.guarantor_mobile)) {
      setAlertMessage("The guarantor mobile number you have entered is incorrect.");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      name: combineTitleName(form.title, form.name),
      phone: fullPhone || null,
      address: form.address || null,
      nic: form.nic.trim() || null,
      company_name: form.company_name.trim() || null,
      email: form.email.trim() || null,
      tax_number: form.tax_number.trim() || null,
      city: form.city.trim() || null,
      is_active: form.is_active,
      credit_limit: Number(form.credit_limit),
      credit_period_days: Number(form.credit_period_days) || 0,
      guarantor_name: form.guarantor_name.trim() || null,
      guarantor_nic: form.guarantor_nic.trim() || null,
      guarantor_mobile: form.guarantor_mobile.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("customers").update(payload).eq("id", form.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setForm({
      id: "",
      title: "",
      name: "",
      phoneCountry: DEFAULT_COUNTRY_CODE,
      phone: "",
      address: "",
      nic: "",
      company_name: "",
      email: "",
      tax_number: "",
      city: "",
      is_active: true,
      credit_limit: "0",
      credit_period_days: "0",
      guarantor_name: "",
      guarantor_nic: "",
      guarantor_mobile: "",
    });
    router.refresh();
  }

  async function handleRecordPayment() {
    if (!payFor) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      customer_id: payFor.id,
      amount,
      method: "cash",
      received_by: user?.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPayFor(null);
    setPayAmount("");
    router.refresh();
  }

  function friendlyDeleteError(name: string, error: { code?: string; message: string }): string {
    if (error.code === "23503") {
      return `Can't delete "${name}" — they have sales, payment, or cheque history.`;
    }
    return `${name}: ${error.message}`;
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
      const allSelected = paginated.length > 0 && paginated.every((c) => prev.has(c.id));
      const next = new Set(prev);
      paginated.forEach((c) => (allSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  }

  function handleDeleteOne(c: Customer) {
    setConfirmDialog({
      message: `Delete "${c.name}"? This can't be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        const { error } = await supabase.from("customers").delete().eq("id", c.id);
        setDeleting(false);
        if (error) {
          setDeleteResult({ deleted: 0, failed: 1, errors: [friendlyDeleteError(c.name, error)] });
        } else {
          setDeleteResult(null);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(c.id);
            return next;
          });
        }
        router.refresh();
      },
    });
  }

  function handleDeleteSelected() {
    const targets = initialCustomers.filter((c) => selectedIds.has(c.id));
    if (targets.length === 0) return;
    setConfirmDialog({
      message: `Delete ${targets.length} selected customer(s)? This can't be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        let deleted = 0;
        const errors: string[] = [];
        for (const c of targets) {
          const { error } = await supabase.from("customers").delete().eq("id", c.id);
          if (error) {
            errors.push(friendlyDeleteError(c.name, error));
          } else {
            deleted++;
          }
        }
        setDeleting(false);
        setDeleteResult({ deleted, failed: errors.length, errors });
        setSelectedIds(new Set());
        router.refresh();
      },
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customers</h1>
          <p className="text-sm text-muted">Manage customer profiles, credit limits, and status.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              title={`Delete ${selectedIds.size} selected customer(s)`}
              aria-label="Delete Selected"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-error/30 text-error hover:bg-error-light"
            >
              <IconTrash className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-semibold flex items-center justify-center">
                {selectedIds.size}
              </span>
            </button>
          )}
          <button onClick={openNew} className={btnPrimary}>
            <IconUserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {deleteResult && (
        <div className={`${cardSurface} p-3 text-sm space-y-1`}>
          <div className="flex items-center justify-between">
            <span>
              <span className="text-accent font-medium">{deleteResult.deleted} deleted</span>
              {deleteResult.failed > 0 && (
                <>
                  {", "}
                  <span className="text-error font-medium">{deleteResult.failed} failed</span>
                </>
              )}
            </span>
            <button onClick={() => setDeleteResult(null)} className="text-muted hover:text-ink">
              ✕
            </button>
          </div>
          {deleteResult.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-error list-disc pl-4 space-y-0.5">
              {deleteResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`${cardSurface} p-4 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <IconFilters className="w-4 h-4" />
            Filters
          </div>
          <button
            onClick={clearFilters}
            className="text-sm px-3 py-1.5 rounded-lg border border-input text-muted hover:bg-surface hover:text-ink"
          >
            Clear
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
          <div>
            <label className={helperText}>Search</label>
            <div className="relative mt-1">
              <IconSearch className={iconLeft} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, mobile, email..."
                className={inputWithIcon}
              />
            </div>
          </div>
          <div>
            <label className={helperText}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | "active" | "inactive");
                setPage(1);
              }}
              className={`${inputBase} mt-1`}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="text-right text-xs text-muted">{filtered.length} customers</div>
      </div>

      <div className={`${cardSurface} overflow-hidden overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={paginated.length > 0 && paginated.every((c) => selectedIds.has(c.id))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-4 py-2 font-medium">Code</th>
              <th className="text-left px-4 py-2 font-medium">Mobile</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">City</th>
              <th className="text-left px-4 py-2 font-medium">Tax Number</th>
              <th className="text-right px-4 py-2 font-medium">Credit Limit</th>
              <th className="text-left px-4 py-2 font-medium">Credit Period</th>
              <th className="text-right px-4 py-2 font-medium">Balance Owed</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card">
            {paginated.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelected(c.id)} />
                </td>
                <td className="px-4 py-2 text-muted font-mono text-xs">{c.customer_code}</td>
                <td className="px-4 py-2 text-ink font-medium">{c.phone}</td>
                <td className="px-4 py-2 text-ink">{c.name}</td>
                <td className="px-4 py-2 text-muted">{c.email}</td>
                <td className="px-4 py-2 text-muted">{c.address}</td>
                <td className="px-4 py-2 text-muted">{c.city}</td>
                <td className="px-4 py-2 text-muted">{c.tax_number ?? "—"}</td>
                <td className="px-4 py-2 text-right text-ink">{c.credit_limit.toFixed(2)}</td>
                <td className="px-4 py-2 text-muted">
                  {c.credit_period_days} {c.credit_period_days === 1 ? "Day" : "Days"}
                </td>
                <td className={`px-4 py-2 text-right font-medium ${c.credit_balance > 0 ? "text-error" : "text-ink"}`}>
                  ${c.credit_balance.toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      c.is_active ? "bg-accent text-white" : "bg-surface text-muted"
                    }`}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(c)} title="Edit" aria-label="Edit" className={iconActionBtn}>
                      <IconPencil className="w-4 h-4" />
                    </button>
                    {c.credit_balance > 0 && (
                      <button
                        onClick={() => setPayFor(c)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent-light"
                      >
                        Record Payment
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOne(c)}
                      title="Delete"
                      aria-label="Delete"
                      className={iconActionBtnDanger}
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-muted">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-card text-sm">
          <span className="text-muted">
            Page {currentPage} · Showing {paginated.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-input text-muted hover:bg-surface hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-input text-muted hover:bg-surface hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent shrink-0">
                  <IconUserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={modalTitle}>{form.id ? "Edit Customer" : "Add Customer"}</h2>
                  <p className="text-sm text-muted">{form.id ? "Update customer details" : "Add new customer"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>
            {error && <div className="rounded-lg bg-error-light text-error text-sm px-3 py-2">{error}</div>}

            <div className={twoColRow}>
              <div className="w-full sm:w-24 shrink-0">
                <label className={fieldLabel}>Title</label>
                <select
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`${inputBase} mt-1`}
                >
                  <option value="">Title</option>
                  {TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <label className={fieldLabel}>
                  Name <span className={requiredMark}>*</span>
                </label>
                <div className="relative mt-1">
                  <IconUser className={iconLeft} />
                  <input
                    placeholder="Enter customers name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputWithIcon}
                  />
                </div>
              </div>
            </div>

            <div className={twoColRow}>
              <div className="w-full sm:w-40 shrink-0">
                <label className={fieldLabel}>Country</label>
                <div className="relative mt-1">
                  <IconGlobe className={iconLeft} />
                  <select
                    value={form.phoneCountry}
                    onChange={(e) => setForm({ ...form, phoneCountry: e.target.value })}
                    className={inputWithIcon}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.name} value={c.dialCode}>
                        {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-full">
                <label className={fieldLabel}>Mobile (optional)</label>
                <div className="relative mt-1">
                  <IconPhone className={iconLeft} />
                  <input
                    type="tel"
                    placeholder="Enter customer mobile number"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputWithIcon}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>NIC (optional)</label>
              <div className="relative mt-1">
                <IconIdCard className={iconLeft} />
                <input
                  placeholder="Enter customer NIC"
                  value={form.nic}
                  onChange={(e) => setForm({ ...form, nic: e.target.value })}
                  className={inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Company Name (optional)</label>
              <div className="relative mt-1">
                <IconBuilding className={iconLeft} />
                <input
                  placeholder="Enter company name"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Email (optional)</label>
              <div className="relative mt-1">
                <IconMail className={iconLeft} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter customer email address"
                  className={inputWithIcon}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Address (optional)</label>
              <div className="relative mt-1">
                <IconMapPin className={iconLeftTop} />
                <textarea
                  placeholder="Street, area, etc."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={3}
                  className={inputWithIcon}
                />
              </div>
            </div>

            <div className={twoColRow}>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>City (optional)</label>
                <div className="relative mt-1">
                  <IconBuilding className={iconLeft} />
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Colombo"
                    className={inputWithIcon}
                  />
                </div>
              </div>
              <div className="w-full sm:w-1/2">
                <label className={fieldLabel}>Tax Number (optional)</label>
                <div className="relative mt-1">
                  <IconFileText className={iconLeft} />
                  <input
                    value={form.tax_number}
                    onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                    placeholder="VAT / TIN"
                    className={inputWithIcon}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border border-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent shrink-0">
                  <IconUsers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">Active</p>
                  <p className="text-sm text-muted">Inactive customers cannot be selected in POS.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  form.is_active ? "bg-accent" : "bg-card"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="border border-card rounded-xl">
              <button
                type="button"
                onClick={() => setShowCreditSection((v) => !v)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent shrink-0">
                    <IconCoins className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-semibold text-ink">Financial / Credit (optional)</p>
                    <p className="text-sm text-muted">Set credit limits, payment terms, etc.</p>
                  </div>
                </div>
                <IconChevronDown
                  className={`w-4 h-4 text-muted transition-transform shrink-0 ${showCreditSection ? "rotate-180" : ""}`}
                />
              </button>
              {showCreditSection && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2 bg-accent-light rounded-lg px-3 py-2.5">
                    <IconInfo className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p className="text-sm text-ink">
                      If you don&apos;t use credit sales, leave defaults (0.00 and 0 days).
                    </p>
                  </div>
                  <div className={twoColRow}>
                    <div className="w-full sm:w-1/2">
                      <label className={fieldLabel}>Credit limit</label>
                      <div className="flex mt-1 rounded-lg border border-input overflow-hidden focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-light">
                        <span className="flex items-center px-3 bg-surface text-sm text-muted border-r border-input">
                          LKR
                        </span>
                        <input
                          type="number"
                          value={form.credit_limit}
                          onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                          className="w-full bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none"
                        />
                      </div>
                      <p className={`${helperText} mt-1`}>Maximum credit amount for this customer.</p>
                    </div>
                    <div className="w-full sm:w-1/2">
                      <label className={fieldLabel}>Credit period (days)</label>
                      <div className="relative mt-1">
                        <IconCalendar className={iconLeft} />
                        <input
                          type="number"
                          value={form.credit_period_days}
                          onChange={(e) => setForm({ ...form, credit_period_days: e.target.value })}
                          className={inputWithIcon}
                        />
                      </div>
                      <p className={`${helperText} mt-1`}>Allowed credit period in days.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-card rounded-xl">
              <button
                type="button"
                onClick={() => setShowGuarantorSection((v) => !v)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent shrink-0">
                    <IconShield className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-semibold text-ink">Guarantor Details (optional)</p>
                    <p className="text-sm text-muted">
                      Add guarantor information if <span className="font-semibold text-ink">required</span>.
                    </p>
                  </div>
                </div>
                <IconChevronDown
                  className={`w-4 h-4 text-muted transition-transform shrink-0 ${showGuarantorSection ? "rotate-180" : ""}`}
                />
              </button>
              {showGuarantorSection && (
                <div className="px-4 pb-4 space-y-3">
                  <div className={twoColRow}>
                    <div className="w-full sm:w-1/2">
                      <label className={fieldLabel}>Guarantor name</label>
                      <div className="relative mt-1">
                        <IconUser className={iconLeft} />
                        <input
                          placeholder="Enter guarantor name"
                          value={form.guarantor_name}
                          onChange={(e) => setForm({ ...form, guarantor_name: e.target.value })}
                          className={inputWithIcon}
                        />
                      </div>
                    </div>
                    <div className="w-full sm:w-1/2">
                      <label className={fieldLabel}>Guarantor NIC</label>
                      <div className="relative mt-1">
                        <IconIdCard className={iconLeft} />
                        <input
                          placeholder="Enter guarantor NIC"
                          value={form.guarantor_nic}
                          onChange={(e) => setForm({ ...form, guarantor_nic: e.target.value })}
                          className={inputWithIcon}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Guarantor mobile</label>
                    <div className="relative mt-1">
                      <IconPhone className={iconLeft} />
                      <input
                        type="tel"
                        placeholder="Enter guarantor mobile number"
                        value={form.guarantor_mobile}
                        onChange={(e) => setForm({ ...form, guarantor_mobile: e.target.value })}
                        className={inputWithIcon}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-card" />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className={btnPrimary}>
                <IconSave className="w-4 h-4" />
                {saving ? "Saving..." : form.id ? "Save Changes" : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {payFor && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold text-ink">Record Payment — {payFor.name}</h2>
            <p className="text-sm text-muted">Currently owes ${payFor.credit_balance.toFixed(2)}</p>
            {error && <div className="rounded-lg bg-error-light text-error text-sm px-3 py-2">{error}</div>}
            <input
              type="number"
              placeholder="Amount"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inputBase}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayFor(null)} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleRecordPayment} className={btnPrimary}>
                Record
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4">
            <p className="text-sm text-ink">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} disabled={deleting} className={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                disabled={deleting}
                className="px-5 py-2.5 rounded-lg bg-error text-white text-sm font-semibold hover:bg-error-hover disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAlertMessage(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4 text-center">
            <p className="text-sm text-ink">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
