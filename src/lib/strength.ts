/**
 * Strength math + formatting shared across the app.
 */

/** Estimated 1-rep max (Epley). Returns the same weight for a 1-rep set. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Round to the nearest plate increment (2.5 lb by default). */
export function roundToPlate(weight: number, step = 2.5): number {
  return Math.round(weight / step) * step;
}

/** Format a weight without trailing ".00" (e.g. 267.5, 170). */
export function fmtWeight(w: number | string): string {
  const n = typeof w === "string" ? parseFloat(w) : w;
  if (Number.isNaN(n)) return "0";
  return (Math.round(n * 100) / 100)
    .toString()
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

/** "4 × 5 @ 170 lb" */
export function fmtScheme(sets: number, reps: number, weight: number | string) {
  return `${sets} × ${reps} @ ${fmtWeight(weight)} lb`;
}

/** Standard warm-up ramp toward a working weight (percent of work set). */
export function warmupSets(workingWeight: number, reps: number) {
  const pcts = [0.45, 0.6, 0.75, 0.9];
  const repPlan = [5, 5, 3, 2];
  return pcts.map((p, i) => ({
    weight: roundToPlate(workingWeight * p),
    reps: reps >= 5 ? repPlan[i] : Math.min(repPlan[i], reps + 1),
    pct: Math.round(p * 100),
  }));
}

/** Tonnage (volume load) for a single set. */
export function setTonnage(weight: number, reps: number) {
  return weight * reps;
}

export const REP_SCHEME_TABS = [
  "1 RM",
  "3 RM",
  "5 RM",
  "1 x 8",
  "3 x 3",
  "3 x 5",
  "3 x 8",
] as const;
