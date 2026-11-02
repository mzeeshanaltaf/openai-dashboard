// Cost line items look like:
//   "gpt-6-luna, input"
//   "flex | gpt-6-luna, cache writes - 12hr"
//   "text-embedding-3-small"
export function parseLineItem(lineItem: string | null): {
  model: string;
  kind: string;
  tier: string;
} {
  if (!lineItem) return { model: "Unattributed", kind: "usage", tier: "standard" };

  let tier = "standard";
  let rest = lineItem.trim();
  const pipe = rest.indexOf(" | ");
  if (pipe !== -1) {
    tier = rest.slice(0, pipe).trim().toLowerCase();
    rest = rest.slice(pipe + 3).trim();
  }

  const comma = rest.lastIndexOf(", ");
  if (comma === -1) return { model: rest, kind: "usage", tier };

  const model = rest.slice(0, comma).trim();
  const rawKind = rest.slice(comma + 2).trim().toLowerCase();
  const kind = rawKind.startsWith("cache write") ? "cache write" : rawKind;
  return { model, kind, tier };
}
