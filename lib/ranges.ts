export type Preset = "7d" | "30d" | "mtd" | "last-month" | "12m" | "custom";

export const PRESETS: { value: Exclude<Preset, "custom">; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "mtd", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "12m", label: "12M" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

// OpenAI buckets usage by UTC day, so ranges are computed in UTC.
export function presetRange(preset: Exclude<Preset, "custom">): { start: string; end: string } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 86400_000));
  switch (preset) {
    case "7d":
      return { start: daysAgo(6), end: iso(today) };
    case "30d":
      return { start: daysAgo(29), end: iso(today) };
    case "12m":
      return { start: iso(new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate() + 1))), end: iso(today) };
    case "mtd":
      return { start: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), end: iso(today) };
    case "last-month":
      return {
        start: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))),
        end: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))),
      };
  }
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
