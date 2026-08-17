/**
 * Chart tokens, in one place, so every visualisation in the app draws from the
 * same validated set.
 *
 * The five series colours were checked with the data-viz palette validator
 * against this app's chart surface (#11151E) in dark mode:
 *
 *   · lightness band, chroma floor, contrast vs surface — all five PASS
 *   · adjacent-pair CVD + normal-vision separation      — all five PASS
 *   · ALL-pair separation                               — first THREE only
 *
 * That last line is a hard constraint, not a preference: with four or more
 * filled polygons in one plot, at least one pair becomes indistinguishable to a
 * deuteranope (ΔE 2.9 for violet↔azure). So `MAX_OVERLAY_SERIES` is 3 and
 * anything larger is drawn as small multiples instead of an overlay.
 */

export const SERIES = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
] as const;

/** Colour follows the entity by slot — never re-assigned when a list re-sorts. */
export function seriesColor(slot: number): string {
  return SERIES[slot % SERIES.length];
}

/** Above this many series, overlays are replaced by small multiples. */
export const MAX_OVERLAY_SERIES = 3;

export const UP = "var(--color-up)";
export const DOWN = "var(--color-down)";

/**
 * A role-relative index (1 = the role's average, higher is always better) as a
 * signed displacement in [-1, 1], where ±1 is twice / half the role average.
 * This is the single number every meter and every radar radius is drawn from.
 */
export function displacement(index: number): number {
  return Math.max(-1, Math.min(1, index - 1));
}

/** The caption under a reading: how far it sits from the role's average. */
export function deviationLabel(index: number): string {
  const pct = Math.round((index - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}
