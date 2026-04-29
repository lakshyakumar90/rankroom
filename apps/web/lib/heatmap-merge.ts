/** Sum per-calendar-day counts across multiple heatmap payloads (embedded profile + `/heatmap` API). */
export function mergeActivityHeatmaps(
  ...maps: Array<Record<string, number> | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [date, raw] of Object.entries(map)) {
      const value =
        typeof raw === "number" && Number.isFinite(raw) ? raw : Number.parseFloat(String(raw)) || 0;
      out[date] = (out[date] ?? 0) + Math.max(0, value);
    }
  }
  return out;
}

/** Years to show in heatmap selectors: years with activity (most active first), plus a rolling window so the dropdown is never empty. */
export function buildHeatmapYearOptions(heatmap: Record<string, number>, historyYears = 12): number[] {
  const currentYear = new Date().getFullYear();
  const totals = new Map<number, number>();

  for (const [dateKey, raw] of Object.entries(heatmap)) {
    const y = Number.parseInt(dateKey.slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    const v = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    totals.set(y, (totals.get(y) ?? 0) + Math.max(0, v));
  }

  const ranked = [...totals.entries()]
    .filter(([, sum]) => sum > 0)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([year]) => year);

  const rolling: number[] = [];
  for (let i = 0; i < historyYears; i++) {
    rolling.push(currentYear - i);
  }

  const merged = new Set<number>([...ranked, ...rolling]);
  return [...merged].sort((a, b) => b - a);
}
