const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US");

// Small amounts keep sub-cent precision so $0.0031 doesn't read as $0.00.
export function formatUsd(value: number) {
  if (value !== 0 && Math.abs(value) < 1) return usd4.format(value);
  return usd2.format(value);
}

export function formatCompact(value: number) {
  return value < 10_000 ? whole.format(Math.round(value)) : compact.format(value);
}

export function formatNumber(value: number) {
  return whole.format(Math.round(value));
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(unixSeconds: number | null) {
  if (!unixSeconds) return "Never";
  return new Date(unixSeconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
