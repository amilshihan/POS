export type Granularity = "daily" | "weekly" | "monthly" | "yearly";

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function bucketKey(iso: string, granularity: Granularity): string {
  const dateOnly = iso.slice(0, 10);
  if (granularity === "daily") return dateOnly;
  if (granularity === "monthly") return dateOnly.slice(0, 7);
  if (granularity === "yearly") return dateOnly.slice(0, 4);
  return isoWeekKey(new Date(dateOnly + "T00:00:00Z"));
}

export function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "daily") {
    const d = new Date(key + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (granularity === "monthly") {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (granularity === "yearly") return key;
  return key;
}

export function bucketSeries(
  rows: { date: string; value: number }[],
  granularity: Granularity
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.date, granularity);
    map.set(key, (map.get(key) ?? 0) + r.value);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => ({ label: bucketLabel(key, granularity), value }));
}
