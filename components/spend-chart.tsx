"use client";

import { useMemo, useState } from "react";
import { BarChart3Icon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildDailySeries, rankIds, type SeriesDef } from "@/lib/derive";
import { formatDay, formatUsd } from "@/lib/format";
import type { CostRow } from "@/lib/types";

type Mode = "project" | "model";

const axisUsd = (v: number) =>
  v === 0 ? "$0" : v < 1 ? `$${Number(v.toPrecision(2))}` : `$${Math.round(v).toLocaleString()}`;

type BarShapeProps = React.ComponentProps<typeof Rectangle> & { payload?: Record<string, unknown> };

function isTopSegment(payload: Record<string, unknown> | undefined, series: SeriesDef[], index: number) {
  if (!payload) return false;
  for (let j = series.length - 1; j > index; j--) {
    if (Number(payload[series[j].key]) > 0) return false;
  }
  return true;
}

type TooltipEntry = { dataKey?: string | number; value?: number | string };

function SpendTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  series: SeriesDef[];
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(series.map((s) => [s.key, s]));
  const items = payload
    .map((p) => ({ def: byKey.get(String(p.dataKey)), value: Number(p.value) || 0 }))
    .filter((i) => i.def && i.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="grid min-w-48 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex justify-between gap-4 font-medium">
        <span>{label ? formatDay(label) : ""}</span>
        <span className="tabular-nums">{formatUsd(total)}</span>
      </div>
      {items.map(({ def, value }) => (
        <div key={def!.key} className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-xs" style={{ background: def!.color }} />
          <span className="flex-1 truncate text-muted-foreground">{def!.label}</span>
          <span className="tabular-nums">{formatUsd(value)}</span>
        </div>
      ))}
      {items.length === 0 && <span className="text-muted-foreground">No spend</span>}
    </div>
  );
}

export function SpendChart({
  costs,
  days,
  projectName,
  projectColors,
  modelColors,
}: {
  costs: CostRow[];
  days: string[];
  projectName: (id: string | null) => string;
  projectColors: Map<string, string>;
  modelColors: Map<string, string>;
}) {
  const [mode, setMode] = useState<Mode>("project");

  const { series, data, config } = useMemo(() => {
    const built =
      mode === "project"
        ? buildDailySeries(
            costs,
            days,
            (c) => c.projectId ?? "unknown",
            (id) => projectName(id === "unknown" ? null : id),
            projectColors,
            [...projectColors.keys()]
          )
        : buildDailySeries(costs, days, (c) => c.model, (id) => id, modelColors, [...modelColors.keys()]);
    const config: ChartConfig = Object.fromEntries(built.series.map((s) => [s.key, { label: s.label, color: s.color }]));
    return { ...built, config };
  }, [mode, costs, days, projectName, projectColors, modelColors]);

  const hasData = rankIds(costs, (c) => c.date).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily spend</CardTitle>
        <CardDescription>USD per UTC day, stacked by {mode}</CardDescription>
        <CardAction>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[mode]}
            onValueChange={(v) => v[0] && setMode(v[0] as Mode)}
          >
            <ToggleGroupItem value="project">Project</ToggleGroupItem>
            <ToggleGroupItem value="model">Model</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatDay}
              />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={axisUsd} />
              <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<SpendTooltip series={series} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="spend"
                  fill={`var(--color-${s.key})`}
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={24}
                  isAnimationActive={false}
                  // Round only the segment that ends up on top of each day's stack.
                  shape={(props: BarShapeProps) => (
                    <Rectangle {...props} radius={isTopSegment(props.payload, series, i) ? [4, 4, 0, 0] : 0} />
                  )}
                />
              ))}
            </BarChart>
          </ChartContainer>
        ) : (
          <Empty className="h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3Icon />
              </EmptyMedia>
              <EmptyTitle>No spend in this range</EmptyTitle>
              <EmptyDescription>Try a wider date range or clear the project filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
