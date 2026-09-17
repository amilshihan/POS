// Shared style tokens for the design system (Inter font, navy/blue palette).
// Reuse these across forms/modals so they stay visually consistent.

export const modalTitle = "text-2xl font-bold text-ink";
export const sectionTitle = "text-lg font-semibold text-ink";
export const fieldLabel = "text-sm font-semibold text-ink";
export const helperText = "text-xs text-muted";
export const requiredMark = "text-error";

export const inputBase =
  "w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder transition-colors focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-light disabled:opacity-60";

export const inputWithIcon = `${inputBase} pl-10`;

export const iconLeft = "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none";
export const iconLeftTop = "w-4 h-4 absolute left-3 top-3.5 text-muted pointer-events-none";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-btn-secondary-border bg-white px-5 py-2.5 text-sm font-semibold text-btn-secondary-text transition-colors hover:bg-surface";

export const btnIconSquare =
  "w-11 h-[46px] shrink-0 flex items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-60";

export const iconActionBtn =
  "w-9 h-9 flex items-center justify-center rounded-lg border border-card text-muted transition-colors hover:bg-surface hover:text-ink";

export const iconActionBtnDanger =
  "w-9 h-9 flex items-center justify-center rounded-lg border border-error/30 text-error transition-colors hover:bg-error-light";

export const cardSurface = "bg-white rounded-xl border border-card";

export const twoColRow = "flex flex-col sm:flex-row gap-4";
