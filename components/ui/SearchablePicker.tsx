"use client";

import { useState } from "react";

export type PickerOption = { id: string; label: string; sublabel?: string; meta?: string };

export default function SearchablePicker({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "None",
  emptyValueLabel,
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Label shown in the closed input when nothing is selected (defaults to placeholder). */
  emptyValueLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? "").toLowerCase().includes(q)
      )
    : options;
  const limited = filtered.slice(0, 50);

  const closedLabel = selected
    ? `${selected.label}${selected.sublabel ? ` (${selected.sublabel})` : ""}`
    : emptyValueLabel ?? "";

  return (
    <div className="relative">
      <input
        value={open ? query : closedLabel}
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
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm ${
              !value ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            {emptyLabel}
            {!value && <span>✓</span>}
          </button>
          {limited.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm ${
                value === o.id ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className="truncate">
                {o.label}
                {o.sublabel && (
                  <span className={value === o.id ? "text-blue-100" : "text-slate-400"}> · {o.sublabel}</span>
                )}
              </span>
              {o.meta && (
                <span className={`shrink-0 text-xs ${value === o.id ? "text-blue-100" : "text-slate-400"}`}>
                  {o.meta}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">No matches.</div>
          )}
          {filtered.length > limited.length && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 text-center border-t border-slate-100">
              Showing first {limited.length} of {filtered.length} — keep typing to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
