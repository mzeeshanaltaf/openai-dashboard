import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OtherUsage as OtherUsageRow } from "@/lib/derive";
import { formatBytes, formatCompact, formatNumber } from "@/lib/format";
import type { UsageCategory } from "@/lib/types";

const LABELS: Partial<Record<UsageCategory, { title: string; unit: (n: number) => string }>> = {
  images: { title: "Images", unit: (n) => `${formatNumber(n)} images generated` },
  audio_speeches: { title: "Text to speech", unit: (n) => `${formatCompact(n)} characters` },
  audio_transcriptions: { title: "Transcription", unit: (n) => `${formatCompact(n / 60)} minutes` },
  moderations: { title: "Moderations", unit: () => "" },
  vector_stores: { title: "Vector stores", unit: (n) => `${formatBytes(n)} stored (latest)` },
  code_interpreter_sessions: { title: "Code interpreter", unit: (n) => `${formatNumber(n)} sessions` },
};

export function OtherUsage({ rows }: { rows: OtherUsageRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Other usage</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const meta = LABELS[r.category]!;
          return (
            <Card key={r.category} size="sm">
              <CardHeader>
                <CardDescription>{meta.title}</CardDescription>
                <CardTitle className="text-xl font-semibold">
                  {r.requests ? `${formatCompact(r.requests)} requests` : meta.unit(r.units)}
                </CardTitle>
              </CardHeader>
              {r.requests > 0 && meta.unit(r.units) && (
                <CardContent className="text-xs text-muted-foreground">{meta.unit(r.units)}</CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
