// Accepts an optional leading "+" and 7-15 digits, ignoring spaces/dashes/
// parentheses (e.g. "071 123 4567", "+94 77 123 4567", "011-1234567").
const PHONE_PATTERN = /^\+?\d{7,15}$/;

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s()-]/g, "");
  return PHONE_PATTERN.test(digits);
}

export const TITLES = ["Mr", "Miss", "Dr", "Rev"];

// Letters, spaces, apostrophes, periods and hyphens only (covers names like
// "Mary-Jane O'Brien" or "J. Perera"), 2-100 characters.
const NAME_PATTERN = /^[A-Za-z\s.'-]{2,100}$/;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name.trim());
}

// Splits a stored full name (possibly title-prefixed, e.g. "Mr. John Silva")
// back into {title, name} for pre-filling the title/name fields when editing.
export function splitTitle(fullName: string): { title: string; name: string } {
  const trimmed = fullName.trim();
  for (const t of TITLES) {
    if (trimmed.startsWith(`${t}. `)) return { title: t, name: trimmed.slice(t.length + 2).trim() };
    if (trimmed.startsWith(`${t} `)) return { title: t, name: trimmed.slice(t.length + 1).trim() };
  }
  return { title: "", name: trimmed };
}

export function combineTitleName(title: string, name: string): string {
  const trimmedName = name.trim();
  return title ? `${title}. ${trimmedName}` : trimmedName;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
