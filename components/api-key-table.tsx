import { ExportButton } from "@/components/table-bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import type { KeyRow } from "@/lib/derive";
import { formatCompact, formatDateTime, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ApiKeyTable({ rows, range }: { rows: KeyRow[]; range: { start: string; end: string } }) {
  const exportCsv = () =>
    downloadCsv(
      `openai-api-keys_${range.start}_${range.end}.csv`,
      ["Key name", "Key ID", "Project", "Spend (USD)", "Tokens", "Requests", "Last used"],
      rows.map((r) => [
        r.name,
        r.id,
        r.projectName,
        r.cost.toFixed(6),
        r.tokens,
        r.requests,
        r.lastUsedAt ? new Date(r.lastUsedAt * 1000).toISOString() : "",
      ])
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Spend per key in range, with last use across all time</CardDescription>
        <CardAction>
          <ExportButton onClick={exportCsv} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Key</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="pr-4">Last used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No API keys for the selected projects
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id || "none"} className={cn(r.cost === 0 && r.requests === 0 && "text-muted-foreground")}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {r.suffix && <span className="font-mono text-xs text-muted-foreground">…{r.suffix}</span>}
                    {r.deleted && <Badge variant="outline">Deleted</Badge>}
                  </div>
                </TableCell>
                <TableCell className="max-w-40 truncate">{r.projectName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(r.cost)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(r.requests)}</TableCell>
                <TableCell className="pr-4 text-xs text-muted-foreground">{r.deleted ? "—" : formatDateTime(r.lastUsedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
