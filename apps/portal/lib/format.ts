const TZ = "Africa/Lagos";

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "Not set";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return new Intl.DateTimeFormat("en-NG", { timeZone: TZ, ...opts }).format(d);
}

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Whole weeks left until a date, never negative. */
export function weeksUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const end = new Date(`${iso}T23:59:59Z`).getTime();
  return Math.max(0, Math.ceil((end - now.getTime()) / (7 * 24 * 3600 * 1000)));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-NG").format(n);
}

/** How to greet someone: staff with a title by title and surname ("Mrs Ishaku"), others by first name. */
export function greetingName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const titled = /^(mr|mrs|ms|miss|dr|prof)\.?$/i.test(parts[0] ?? "");
  if (titled && parts.length > 1) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0] ?? name;
}

/** ₦680,000 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "–";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}
