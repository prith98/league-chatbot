/**
 * Approximate GLOBAL per-role average stats, pooled across ranks. Used to
 * normalize role-dependent metrics so a support and an ADC can be compared
 * fairly: each stat is expressed as a multiple of its own role's average.
 *
 * No Riot or OP.GG endpoint exposes these, so they are hand-tuned reference
 * points — intentionally rough, and the single place to adjust as the meta
 * shifts. Because they're pooled across all ranks (not per-tier), a stronger /
 * higher-ranked player naturally lands above 1.0×, so head-to-head still shows
 * who's better — normalization only removes the ROLE distortion, not skill.
 */

export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

interface RoleBaseline {
  kda: number;
  kp: number; // kill participation, %
  damageShare: number; // share of team champ damage, %
  csPerMin: number;
  dpm: number;
  goldPerMin: number;
  deathShare: number; // share of team deaths, % (lower is better)
  visionScorePerMin: number; // map control per minute — supports far outweigh carries
}

const BASELINES: Record<Role, RoleBaseline> = {
  TOP: { kda: 2.4, kp: 50, damageShare: 22, csPerMin: 6.5, dpm: 600, goldPerMin: 380, deathShare: 20, visionScorePerMin: 0.65 },
  JUNGLE: { kda: 2.6, kp: 65, damageShare: 20, csPerMin: 5.2, dpm: 550, goldPerMin: 370, deathShare: 20, visionScorePerMin: 0.9 },
  MIDDLE: { kda: 2.7, kp: 62, damageShare: 27, csPerMin: 7.0, dpm: 750, goldPerMin: 410, deathShare: 19, visionScorePerMin: 0.7 },
  BOTTOM: { kda: 2.7, kp: 60, damageShare: 28, csPerMin: 7.5, dpm: 780, goldPerMin: 420, deathShare: 19, visionScorePerMin: 0.8 },
  UTILITY: { kda: 2.8, kp: 65, damageShare: 12, csPerMin: 1.3, dpm: 350, goldPerMin: 250, deathShare: 22, visionScorePerMin: 1.9 },
};

// Fallback when a player's role is unknown — a rough all-role average.
const DEFAULT_BASELINE: RoleBaseline = {
  kda: 2.6,
  kp: 60,
  damageShare: 22,
  csPerMin: 5.5,
  dpm: 600,
  goldPerMin: 370,
  deathShare: 20,
  visionScorePerMin: 0.85,
};

export type MetricKey = keyof RoleBaseline;

function baselineFor(role: string | undefined): RoleBaseline {
  return (role && BASELINES[role as Role]) || DEFAULT_BASELINE;
}

/**
 * Express a metric as a multiple of its role average where HIGHER IS ALWAYS
 * BETTER. 1.0 = average for the role; >1 is above average. Death share is
 * inverted (fewer deaths than the role norm → >1). Use this for comparison
 * coloring and radar radius — anything where "bigger = better" must hold.
 */
export function roleIndex(
  role: string | undefined,
  key: MetricKey,
  value: number | undefined,
): number {
  if (typeof value !== "number") return 1;
  const base = baselineFor(role)[key];
  if (!base) return 1;
  if (key === "deathShare") return value > 0 ? base / value : 2;
  return value / base;
}

/**
 * Human-readable deviation from the role average, e.g. "+18% vs avg". This is
 * the RAW deviation (not inverted), so a below-average death share reads as a
 * negative number — which correctly says "fewer deaths than average".
 */
export function pctVsRoleAvg(
  role: string | undefined,
  key: MetricKey,
  value: number | undefined,
): string | undefined {
  if (typeof value !== "number") return undefined;
  const base = baselineFor(role)[key];
  if (!base) return undefined;
  const pct = Math.round((value / base - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs avg`;
}
