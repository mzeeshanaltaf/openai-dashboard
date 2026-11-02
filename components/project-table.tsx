"use client";

import { Fragment, useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { BudgetMeter } from "@/components/budget-meter";
import { ExportButton, ShareBar, Sparkline, Swatch } from "@/components/table-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import type { Breakdown, ProjectRow } from "@/lib/derive";
import { formatCompact, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

function BreakdownList({ title, items }: { title: string; items: Breakdown[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {items.length === 0 ? (
        <span className="text-xs text-muted-foreground">No spend in range</span>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id || "none"} className="flex items-center justify-between gap-4 text-xs">
              <span className="truncate">{item.label}</span>
              <span className="tabular-nums">{formatUsd(item.cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectTable({ rows, range }: { rows: ProjectRow[]; range: { start: string; end: string } }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showIdle, setShowIdle] = useState(false);
  // Idle = nothing spent or requested in range and nothing this month.
  const isIdle = (r: ProjectRow) => r.cost === 0 && r.requests === 0 && r.mtdCost === 0;
  const idleCount = rows.filter(isIdle).length;
  const visibleRows = showIdle ? rows : rows.filter((r) => !isIdle(r));
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () =>
    downloadCsv(
      `openai-projects_${range.start}_${range.end}.csv`,
      ["Project", "Project ID", "Spend (USD)", "Share", "Input tokens", "Output tokens", "Requests", "Month-to-date (USD)", "Monthly budget (USD)"],
      rows.map((r) => [r.name, r.id, r.cost.toFixed(6), r.share.toFixed(4), r.inputTokens, r.outputTokens, r.requests, r.mtdCost.toFixed(6), r.budget ?? ""])
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>Spend and usage per project in the selected range. Expand a row for models and keys.</CardDescription>
        <CardAction>
          <ExportButton onClick={exportCsv} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 pl-4" />
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead>Share</TableHead>
              <TableHead className="text-right">Tokens in / out</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead className="min-w-44 pr-4">This month vs budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((r) => {
              const open = expanded.has(r.id);
              const idle = r.cost === 0 && r.requests === 0;
              return (
                <Fragment key={r.id}>
                  <TableRow className={cn(idle && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggle(r.id)}
                        aria-expanded={open}
                        aria-label={`${open ? "Collapse" : "Expand"} ${r.name}`}
                      >
                        <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Swatch color={r.color} />
                        <span className="font-medium">{r.name}</span>
                        {r.archived && <Badge variant="outline">Archived</Badge>}
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
                    <TableCell className="text-right tabular-nums">{formatCompact(r.requests)}</TableCell>
                    <TableCell>
                      <Sparkline values={r.daily} />
                    </TableCell>
                    <TableCell className="pr-4">
                      {r.budget ? (
                        <BudgetMeter spent={r.mtdCost} budget={r.budget} compact />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.mtdCost > 0 ? `${formatUsd(r.mtdCost)} · no budget` : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={7} className="whitespace-normal pr-4">
                        <div className="grid gap-6 py-2 md:grid-cols-2">
                          <BreakdownList title="By model" items={r.models} />
                          <BreakdownList title="By API key" items={r.keys} />
                        </div>
                        <p className="pt-2 font-mono text-[11px] text-muted-foreground">{r.id}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {idleCount > 0 && (
          <div className="flex justify-center border-t pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowIdle((v) => !v)}>
              {showIdle ? "Hide" : "Show"} {idleCount} project{idleCount === 1 ? "" : "s"} with no activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
