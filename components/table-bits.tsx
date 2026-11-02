import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <DownloadIcon data-icon="inline-start" />
      CSV
    </Button>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

// Thin share bar; the percentage beside it carries the value.
export function ShareBar({ share }: { share: number }) {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-series-1" style={{ width: `${Math.min(share, 1) * 100}%` }} />
    </div>
  );
}

export function Sparkline({ values, width = 88, height = 24 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 0);
  if (values.length < 2 || max === 0) {
    return <div style={{ width, height }} className="flex items-center"><div className="h-px w-full bg-border" /></div>;
  }
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} aria-hidden className="text-muted-foreground">
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
