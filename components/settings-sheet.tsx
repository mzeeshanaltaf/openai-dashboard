"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDay, formatUsd } from "@/lib/format";
import { todayIso } from "@/lib/ranges";
import type { Budget, CreditGrant, DashboardData } from "@/lib/types";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
}

function CreditsSection({ grants, onSaved }: { grants: CreditGrant[]; onSaved: () => void }) {
  const [form, setForm] = useState({ amount: "", grantedAt: todayIso(), expiresAt: "", note: "" });
  const [busy, setBusy] = useState(false);
  const today = todayIso();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await send("/api/credits", "POST", {
        amountUsd: Number(form.amount),
        grantedAt: form.grantedAt,
        expiresAt: form.expiresAt || null,
        note: form.note || null,
      });
      setForm({ amount: "", grantedAt: todayIso(), expiresAt: "", note: "" });
      toast.success("Credit top-up added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add credit");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await send(`/api/credits?id=${id}`, "DELETE");
      toast.success("Credit top-up removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove credit");
    }
  };

  return (
    <FieldSet>
      <FieldLegend>Credit top-ups</FieldLegend>
      <FieldDescription>
        Copy each purchase from OpenAI&apos;s billing page. Remaining balance = active credits − actual spend since the
        earliest active top-up. Expired credits are excluded.
      </FieldDescription>

      {grants.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {grants.map((g) => {
            const expired = g.expiresAt !== null && g.expiresAt < today;
            return (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {formatUsd(g.amountUsd)}
                    {expired && <span className="ml-2 text-xs font-normal text-muted-foreground">(expired)</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDay(g.grantedAt)} {new Date(`${g.grantedAt}T00:00:00Z`).getUTCFullYear()}
                    {g.expiresAt && ` · expires ${g.expiresAt}`}
                    {g.note && ` · ${g.note}`}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(g.id)} aria-label="Remove top-up">
                  <Trash2Icon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add}>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="credit-amount">Amount (USD)</FieldLabel>
              <Input
                id="credit-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="credit-date">Purchased on</FieldLabel>
              <Input
                id="credit-date"
                type="date"
                required
                max={today}
                value={form.grantedAt}
                onChange={(e) => setForm((f) => ({ ...f, grantedAt: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="credit-expiry">Expires (optional)</FieldLabel>
              <Input
                id="credit-expiry"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="credit-note">Note (optional)</FieldLabel>
              <Input
                id="credit-note"
                maxLength={200}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Field>
          </div>
          <Button type="submit" disabled={busy || !form.amount}>
            <PlusIcon data-icon="inline-start" />
            Add top-up
          </Button>
        </FieldGroup>
      </form>
    </FieldSet>
  );
}

function BudgetsSection({ data, onSaved }: { data: DashboardData; onSaved: () => void }) {
  const toDraft = (budgets: Budget[]) =>
    Object.fromEntries(budgets.map((b) => [b.scope, String(b.monthlyUsd)])) as Record<string, string>;
  const [draft, setDraft] = useState(() => toDraft(data.budgets));
  const [busy, setBusy] = useState(false);

  const scopes = [
    { scope: "total", label: "Whole organization" },
    ...data.projects
      .filter((p) => p.status !== "archived")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ scope: p.id, label: p.name })),
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const budgets = Object.entries(draft)
        .map(([scope, value]) => ({ scope, monthlyUsd: Number(value) }))
        .filter((b) => b.monthlyUsd > 0);
      await send("/api/budgets", "PUT", budgets);
      toast.success("Budgets saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save budgets");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <FieldSet>
        <FieldLegend>Monthly budgets</FieldLegend>
        <FieldDescription>
          Compared against month-to-date spend. Amber at 80%, red at 100%. Leave empty for no budget.
        </FieldDescription>
        <FieldGroup className="gap-3">
          {scopes.map(({ scope, label }) => (
            <Field key={scope} orientation="horizontal">
              <FieldLabel htmlFor={`budget-${scope}`} className="flex-1 truncate">
                {label}
              </FieldLabel>
              <Input
                id={`budget-${scope}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="—"
                className="w-28"
                value={draft[scope] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [scope]: e.target.value }))}
              />
            </Field>
          ))}
          <Button type="submit" disabled={busy}>
            Save budgets
          </Button>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}

export function SettingsSheet({
  open,
  onOpenChange,
  data,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardData;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Credits & budgets</SheetTitle>
          <SheetDescription>Stored on the dashboard server, not in OpenAI.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <CreditsSection grants={data.grants} onSaved={onSaved} />
          <Separator />
          {/* Remount when saved budgets change so the draft resets to server state. */}
          <BudgetsSection key={JSON.stringify(data.budgets)} data={data} onSaved={onSaved} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
