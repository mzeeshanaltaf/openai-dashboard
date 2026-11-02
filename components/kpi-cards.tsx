import { AlertTriangleIcon, PlusIcon } from "lucide-react";

import { BudgetMeter } from "@/components/budget-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { budgetFor, enumerateDays, type Totals } from "@/lib/derive";
import { formatCompact, formatDay, formatPercent, formatUsd } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

function Stat({ label, value, detail }: { label: string; value: string; detail: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

export function KpiCards({
  data,
  totals,
  filtered,
  onOpenSettings,
}: {
  data: DashboardData;
  totals: Totals;
  filtered: boolean;
  onOpenSettings: () => void;
}) {
  const { balance, mtd } = data;
  const rangeDays = enumerateDays(data.range.start, data.range.end).length;
  const dailyAverage = totals.cost / rangeDays;
  const totalBudget = budgetFor(data.budgets, "total");
  const totalTokens = totals.inputTokens + totals.outputTokens;

  const remainingRatio = balance && balance.totalCredits > 0 ? balance.remaining / balance.totalCredits : null;
  const lowBalance = remainingRatio !== null && remainingRatio < 0.2;
  // Runway uses the org-wide month-to-date pace, independent of filters.
  const orgDailyRate = mtd.cost / mtd.daysElapsed;
  const runwayDays = balance && orgDailyRate > 0 ? balance.remaining / orgDailyRate : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Remaining balance · organization</CardDescription>
            {balance && lowBalance && (
              <CardAction>
                <Badge variant="destructive">
                  <AlertTriangleIcon data-icon="inline-start" />
                  Low balance
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {balance ? (
              <div className="flex flex-col gap-2">
                <span className="text-5xl font-semibold tracking-tight">{formatUsd(balance.remaining)}</span>
                <span className="text-sm text-muted-foreground">
                  {formatUsd(balance.spent)} spent of {formatUsd(balance.totalCredits)} credits since{" "}
                  {formatDay(balance.since)}
                  {runwayDays !== null && <> · ~{Math.max(0, Math.floor(runwayDays))} days left at this month&apos;s pace</>}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <span className="text-sm text-muted-foreground">
                  OpenAI doesn&apos;t expose your credit balance to API keys. Record your top-ups once and the
                  dashboard subtracts actual spend.
                </span>
                <Button size="sm" onClick={onOpenSettings}>
                  <PlusIcon data-icon="inline-start" />
                  Add credit top-up
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>This month · organization</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-5xl font-semibold tracking-tight">{formatUsd(mtd.cost)}</span>
              <span className="text-sm text-muted-foreground">
                Forecast {formatUsd(mtd.forecast)} by month end · day {mtd.daysElapsed} of {mtd.daysInMonth}
              </span>
            </div>
          </CardContent>
          {totalBudget !== null && (
            <CardFooter>
              <div className="w-full">
                <BudgetMeter spent={mtd.cost} budget={totalBudget} />
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label={filtered ? "Spend in range · filtered" : "Spend in range"}
          value={formatUsd(totals.cost)}
          detail={`${formatUsd(dailyAverage)} per day on average`}
        />
        <Stat
          label="Tokens"
          value={formatCompact(totalTokens)}
          detail={`${formatCompact(totals.inputTokens)} input · ${formatCompact(totals.outputTokens)} output`}
        />
        <Stat
          label="Requests"
          value={formatCompact(totals.requests)}
          detail={totals.requests ? `${formatCompact(totalTokens / totals.requests)} tokens per request` : "No requests"}
        />
        <Stat
          label="Cache hit rate"
          value={totals.inputTokens ? formatPercent(totals.cachedTokens / totals.inputTokens) : "—"}
          detail={`${formatCompact(totals.cachedTokens)} cached input tokens`}
        />
      </div>
    </section>
  );
}
