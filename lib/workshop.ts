export const SERVICE_CATEGORIES: { value: string; label: string }[] = [
  { value: "routine_maintenance", label: "Routine Maintenance" },
  { value: "wear_and_tear", label: "Wear & Tear Replacements" },
  { value: "diagnostics_engine", label: "Diagnostics & Engine Repairs" },
  { value: "suspension_steering", label: "Suspension & Steering" },
  { value: "electrical", label: "Electrical System Repairs" },
  { value: "customization_upgrades", label: "Customization & Upgrades" },
  { value: "cleaning_detailing", label: "Cleaning, Detailing & Inspections" },
];

export function serviceCategoryLabel(value: string | null): string {
  return SERVICE_CATEGORIES.find((c) => c.value === value)?.label ?? "—";
}

export const JOB_CARD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const JOB_CARD_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export function jobCardStatusLabel(status: string): string {
  return { pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" }[
    status
  ] ?? status;
}
