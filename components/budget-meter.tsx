import { AlertTriangleIcon, CheckCircle2Icon, OctagonAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { budgetState } from "@/lib/derive";
import { formatPercent, formatUsd } from "@/lib/format";

const STATES = {
  ok: { icon: CheckCircle2Icon, label: "On budget", fill: "bg-status-good", ink: "text-muted-foreground" },
  warning: { icon: AlertTriangleIcon, label: "Near budget", fill: "bg-status-warning", ink: "text-foreground" },
  over: { icon: OctagonAlertIcon, label: "Over budget", fill: "bg-status-critical", ink: "text-destructive" },
} as const;

// Status always ships with icon + label, never color alone.
export function BudgetMeter({ spent, budget, compact = false }: { spent: number; budget: number; compact?: boolean }) {
  const state = STATES[budgetState(spent, budget)];
  const Icon = state.icon;
  const ratio = spent / budget;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatUsd(spent)} of ${formatUsd(budget)} budget, ${state.label}`}
      >
        <div className={cn("h-full rounded-full", state.fill)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div className={cn("flex items-center gap-1 text-xs", state.ink)}>
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">
          {compact
            ? `${formatPercent(ratio)} of ${formatUsd(budget)}`
            : `${state.label} · ${formatPercent(ratio)} of ${formatUsd(budget)}`}
        </span>
      </div>
    </div>
  );
}
