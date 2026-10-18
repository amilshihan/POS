export const CURRENCIES = [
  { code: "LKR", label: "Sri Lankan Rupee (LKR)", symbol: "Rs." },
  { code: "USD", label: "US Dollar (USD)", symbol: "$" },
  { code: "EUR", label: "Euro (EUR)", symbol: "€" },
  { code: "GBP", label: "British Pound (GBP)", symbol: "£" },
  { code: "INR", label: "Indian Rupee (INR)", symbol: "₹" },
  { code: "AUD", label: "Australian Dollar (AUD)", symbol: "A$" },
] as const;

export const DEFAULT_CURRENCY_CODE = "LKR";

export function getCurrencySymbol(code: string | null | undefined): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "Rs.";
}
