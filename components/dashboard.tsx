"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { ApiKeyTable } from "@/components/api-key-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { KpiCards } from "@/components/kpi-cards";
import { ModelTable } from "@/components/model-table";
import { OtherUsage } from "@/components/other-usage";
import { ProjectTable } from "@/components/project-table";
import { SettingsSheet } from "@/components/settings-sheet";
import { SpendChart } from "@/components/spend-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  buildColorMap,
  computeTotals,
  deriveKeys,
  deriveModels,
  deriveOtherUsage,
  deriveProjects,
  enumerateDays,
  filterByProjects,
  rankIds,
} from "@/lib/derive";
import { PRESETS, presetRange, type Preset } from "@/lib/ranges";
import type { DashboardData } from "@/lib/types";

const STORAGE_KEY = "oad:view";

type View = { preset: Preset; start: string; end: string; projects: string[] };

function loadView(): View {
  const fallback: View = { preset: "30d", ...presetRange("30d"), projects: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as View | null;
    if (!saved) return fallback;
    // A preset removed in a later release (e.g. "90d") falls back to the default.
    if (saved.preset !== "custom" && !PRESETS.some((p) => p.value === saved.preset)) return fallback;
    // Presets are recomputed so "30D" always means the last 30 days from today.
    return saved.preset === "custom" ? saved : { ...saved, ...presetRange(saved.preset) };
  } catch {
    return fallback;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>(loadView);
  const [data, setData] = useState<DashboardData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Each load is identified by a key; loading = the latest key hasn't settled yet.
  const [reloadToken, setReloadToken] = useState(0);
  const [settled, setSettled] = useState<{ key: string; error: string | null }>({ key: "", error: null });
  const bypassCache = useRef(false);
  const requestKey = `${view.start}|${view.end}|${reloadToken}`;
  const loading = settled.key !== requestKey;
  const error = settled.error;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
      // storage unavailable: view just won't persist
    }
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ start: view.start, end: view.end });
    if (bypassCache.current) qs.set("refresh", "1");
    bypassCache.current = false;

    fetch(`/api/dashboard?${qs}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
        if (!cancelled) {
          setData(json);
          setSettled({ key: requestKey, error: null });
        }
      })
      .catch((e) => {
        if (!cancelled) setSettled({ key: requestKey, error: e instanceof Error ? e.message : "Failed to load data" });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, view.start, view.end, router]);

  const load = useCallback((refresh = false) => {
    bypassCache.current = refresh;
    setReloadToken((t) => t + 1);
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const projectName = (id: string | null) =>
      (id && data.projects.find((p) => p.id === id)?.name) || (id ? "Unknown project" : "—");
    const keyName = (id: string | null) =>
      id ? data.apiKeys.find((k) => k.id === id)?.name || "Deleted key" : "No API key";

    // Colors come from the unfiltered range so filtering never repaints a series.
    const projectColors = buildColorMap(rankIds(data.costs, (c) => c.projectId ?? "unknown"));
    const modelColors = buildColorMap(rankIds(data.costs, (c) => c.model));

    const costs = filterByProjects(data.costs, view.projects);
    const usage = filterByProjects(data.usage, view.projects);
    const days = enumerateDays(data.range.start, data.range.end);

    return {
      days,
      costs,
      projectName,
      projectColors,
      modelColors,
      totals: computeTotals(costs, usage),
      projects: deriveProjects(data, costs, usage, days, view.projects, projectColors, keyName),
      models: deriveModels(costs, usage, modelColors),
      keys: deriveKeys(data, costs, usage, view.projects, projectName),
      other: deriveOtherUsage(usage),
    };
  }, [data, view.projects]);

  if (!data && loading) return <DashboardSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        view={view}
        onViewChange={(next) => setView((v) => ({ ...v, ...next }))}
        projects={data?.projects ?? []}
        loading={loading}
        generatedAt={data?.generatedAt ?? null}
        onRefresh={() => load(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Couldn&apos;t load OpenAI data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && derived && (
        <>
          <KpiCards
            data={data}
            totals={derived.totals}
            filtered={view.projects.length > 0}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <SpendChart
            costs={derived.costs}
            days={derived.days}
            projectName={derived.projectName}
            projectColors={derived.projectColors}
            modelColors={derived.modelColors}
          />
          <ProjectTable rows={derived.projects} range={data.range} />
          <div className="grid gap-6">
            <ModelTable rows={derived.models} range={data.range} />
            <ApiKeyTable rows={derived.keys} range={data.range} />
          </div>
          <OtherUsage rows={derived.other} />
          <SettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            data={data}
            onSaved={() => load()}
          />
        </>
      )}
    </div>
  );
}
