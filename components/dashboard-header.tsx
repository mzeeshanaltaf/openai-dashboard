"use client";

import { useState } from "react";
import {
  CalendarIcon,
  FilterIcon,
  LogOutIcon,
  MoonIcon,
  RefreshCwIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay } from "@/lib/format";
import { PRESETS, presetRange, todayIso, type Preset } from "@/lib/ranges";
import type { Project } from "@/lib/types";

type View = { preset: Preset; start: string; end: string; projects: string[] };

export function DashboardHeader({
  view,
  onViewChange,
  projects,
  loading,
  generatedAt,
  onRefresh,
  onOpenSettings,
}: {
  view: View;
  onViewChange: (next: Partial<View>) => void;
  projects: Project[];
  loading: boolean;
  generatedAt: number | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ start: view.start, end: view.end });

  const selected = new Set(view.projects);
  const toggleProject = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onViewChange({ projects: [...next] });
  };

  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  const filterLabel =
    view.projects.length === 0
      ? "All projects"
      : view.projects.length === 1
        ? (projects.find((p) => p.id === view.projects[0])?.name ?? "1 project")
        : `${view.projects.length} projects`;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">OpenAI Usage</h1>
          <p className="text-sm text-muted-foreground">
            {formatDay(view.start)} – {formatDay(view.end)} (UTC)
            {generatedAt && (
              <> · Updated {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} />}
            >
              <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
              <span className="sr-only">Refresh</span>
            </TooltipTrigger>
            <TooltipContent>Refresh from OpenAI</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                />
              }
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span className="sr-only">Toggle theme</span>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={onOpenSettings} />}>
              <SettingsIcon />
              <span className="sr-only">Credits & budgets</span>
            </TooltipTrigger>
            <TooltipContent>Credits & budgets</TooltipContent>
          </Tooltip>
          <form method="post" action="/api/logout">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" type="submit" />}>
                <LogOutIcon />
                <span className="sr-only">Sign out</span>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={view.preset === "custom" ? [] : [view.preset]}
          onValueChange={(value) => {
            const preset = value[0] as Exclude<Preset, "custom"> | undefined;
            if (preset) onViewChange({ preset, ...presetRange(preset) });
          }}
        >
          {PRESETS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Popover
          open={customOpen}
          onOpenChange={(open) => {
            setCustomOpen(open);
            if (open) setDraft({ start: view.start, end: view.end });
          }}
        >
          <PopoverTrigger
            render={<Button variant={view.preset === "custom" ? "secondary" : "outline"} size="sm" />}
          >
            <CalendarIcon data-icon="inline-start" />
            Custom
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.start && draft.end && draft.start <= draft.end) {
                  onViewChange({ preset: "custom", ...draft });
                  setCustomOpen(false);
                }
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="range-start">From</FieldLabel>
                  <Input
                    id="range-start"
                    type="date"
                    value={draft.start}
                    max={draft.end || todayIso()}
                    onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="range-end">To</FieldLabel>
                  <Input
                    id="range-end"
                    type="date"
                    value={draft.end}
                    min={draft.start}
                    max={todayIso()}
                    onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                  />
                </Field>
                <Button type="submit" size="sm" disabled={!draft.start || !draft.end || draft.start > draft.end}>
                  Apply range
                </Button>
              </FieldGroup>
            </form>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant={view.projects.length ? "secondary" : "outline"} size="sm" />}
          >
            <FilterIcon data-icon="inline-start" />
            {filterLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              {sortedProjects.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={selected.has(p.id)}
                  onCheckedChange={(checked) => toggleProject(p.id, checked)}
                  closeOnClick={false}
                >
                  <span className="truncate">{p.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            {view.projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onViewChange({ projects: [] })}>Show all projects</DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
