import { ExportButton, ShareBar, Swatch } from "@/components/table-bits";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import type { ModelRow } from "@/lib/derive";
import { formatCompact, formatPercent, formatUsd } from "@/lib/format";

function tierSummary(tiers: Record<string, number>) {
  const entries = Object.entries(tiers).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length <= 1) return entries[0]?.[0] ?? "—";
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return entries.map(([tier, v]) => `${tier} ${formatPercent(v / total)}`).join(" · ");
}

export function ModelTable({ rows, range }: { rows: ModelRow[]; range: { start: string; end: string } }) {
  const exportCsv = () =>
    downloadCsv(
      `openai-models_${range.start}_${range.end}.csv`,
      ["Model", "Spend (USD)", "Share", "Input tokens", "Output tokens", "Cached input tokens", "Requests", ...["standard", "flex", "batch", "priority"].map((t) => `${t} (USD)`)],
      rows.map((r) => [
        r.model,
        r.cost.toFixed(6),
        r.share.toFixed(4),
        r.inputTokens,
        r.outputTokens,
        r.cachedTokens,
        r.requests,
        ...["standard", "flex", "batch", "priority"].map((t) => (r.tiers[t] ?? 0).toFixed(6)),
      ])
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
        <CardDescription>Spend, tokens and cache efficiency per model</CardDescription>
        <CardAction>
          <ExportButton onClick={exportCsv} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Model</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead>Share</TableHead>
              <TableHead className="text-right">Tokens in / out</TableHead>
              <TableHead className="text-right">Cache hit</TableHead>
              <TableHead className="pr-4">Tier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No model usage in this range
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.model}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2">
                    <Swatch color={r.color} />
                    <span className="font-medium">{r.model}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(r.cost)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ShareBar share={r.share} />
                    <span className="w-10 text-xs tabular-nums text-muted-foreground">{formatPercent(r.share)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompact(r.inputTokens)} / {formatCompact(r.outputTokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.inputTokens ? formatPercent(r.cachedTokens / r.inputTokens) : "—"}
                </TableCell>
                <TableCell className="pr-4 text-xs text-muted-foreground capitalize">{tierSummary(r.tiers)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
