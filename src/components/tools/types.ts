import type { IconName } from "@/components/ui/icons";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error";

export interface ToolPart {
  type: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolName?: string; // present on dynamic-tool parts
}

/* ---------------------------------------------------------------------------
   Tools split into two kinds, and the UI treats them differently.

   A `step` is something the agent did on the way to an answer — a lookup, a
   fetch. Six of those inline used to bury the one card the person asked for.
   Steps now collapse into a single run log; `report` tools render in full.
   ------------------------------------------------------------------------ */
export type ToolKind = "report" | "step";

export const TOOL_META: Record<string, { icon: IconName; label: string; kind: ToolKind }> = {
  analyzePlayerStats: { icon: "radar", label: "Player scouting report", kind: "report" },
  comparePlayerStats: { icon: "versus", label: "Head-to-head", kind: "report" },
  analyzeTeam: { icon: "lineup", label: "Team draft plan", kind: "report" },
  analyzeTeammates: { icon: "graph", label: "Flex squad breakdown", kind: "report" },
  lookupSummoner: { icon: "search", label: "Summoner lookup", kind: "step" },
  getMatchHistory: { icon: "list", label: "Match history", kind: "step" },
  getChampionMastery: { icon: "star", label: "Champion mastery", kind: "step" },
};

export function toolKey(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "opgg";
  return part.type.slice(5); // strip "tool-"
}

/**
 * OP.GG's tools arrive over MCP and are discovered at runtime, so they have no
 * entry here. Depending on how the SDK types the part they surface either as
 * `dynamic-tool` or as `tool-lol_get_champion_analysis`; either way the raw
 * snake_case identifier is a developer's name for the call, not a person's, so
 * it gets rewritten into a readable one.
 */
function readableOpgg(key: string): string {
  const words = key.replace(/^lol_/, "").replace(/_/g, " ").trim();
  return `OP.GG · ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function toolMeta(part: ToolPart): { icon: IconName; label: string; kind: ToolKind } {
  const key = toolKey(part);
  const known = TOOL_META[key];
  if (known) return known;
  return { icon: "globe", label: readableOpgg(key), kind: "step" };
}

export const isReport = (part: ToolPart) => toolMeta(part).kind === "report";

/* ------------------------------------------------------------ data shapes -- */

export interface ChampStat {
  champion: string;
  games: number;
  winRate: number;
  role?: string;
  kda?: number;
  csPerMin?: number;
  dpm?: number;
  kp?: number;
  damageShare?: number;
  deathShare?: number;
  vsRoleAvg?: {
    csPerMin?: string;
    damageShare?: string;
    dpm?: string;
    kp?: string;
    deathShare?: string;
  };
}

export interface RoleStat {
  role: string;
  games: number;
  pct: number;
}

export interface FormStat {
  recentWinRate: number;
  priorWinRate: number;
  trend: "up" | "down" | "flat";
}

export interface WindowStat {
  games: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  primaryRole?: string;
  roles?: RoleStat[];
  kda?: number;
  kdaStdev?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  dpm?: number;
  goldPerMin?: number;
  kp?: number;
  damageShare?: number;
  deathShare?: number;
  visionScore?: number;
  visionScorePerMin?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  form?: FormStat;
  topChampions?: ChampStat[];
}

export interface PlayerPayload {
  riotId: string;
  region: string;
  summonerLevel: number;
  rank: string;
  totalGames: number;
  stats: Record<string, WindowStat>;
  byRole?: Record<string, Record<string, WindowStat>>;
  availableRoles?: string[];
}

export interface MasteryChamp {
  champion: string;
  level: number;
  points: number;
}

export interface TeamPlayer extends PlayerPayload {
  mastery?: MasteryChamp[];
  roleAffinity?: Record<string, { games: number; winRate: number }>;
}

export interface AssignmentRow {
  riotId: string;
  role: string;
  gamesInRole: number;
  primaryRole: string;
}

export const OUTCOME_KEYS = ["all", "wins", "losses"] as const;
export type OutcomeKey = (typeof OUTCOME_KEYS)[number];

export interface TeammatePlayer {
  riotId: string;
  region: string;
  summonerLevel: number;
  rank: string;
  totalGames: number;
  gamesTogether: number;
  together: Record<OutcomeKey, WindowStat>;
  playedWith: { riotId: string; games: number }[];
}

/* ---------------------------------------------------------------- labels -- */

export const WINDOW_LABELS: Record<string, string> = {
  "10": "10",
  "15": "15",
  "20": "20",
  "25": "25",
  "50": "50",
  all: "All",
  wins: "Wins",
  losses: "Losses",
};

export const QUEUE_LABELS: Record<string, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
  both: "Solo + Flex",
};

export const ROLE_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
  UNKNOWN: "—",
};

export const roleLabel = (r?: string) => (r ? (ROLE_LABELS[r] ?? r) : "—");

/** Riot IDs are `Name#TAG`; the tag is noise in a chart legend or a row title. */
export const gameName = (riotId: string) => riotId.split("#")[0];

export const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
export const roleRank = (r: string) => {
  const i = ROLE_ORDER.indexOf(r);
  return i === -1 ? 99 : i;
};

/** A role's share of games, e.g. "ADC 72% · Top 28%". */
export function rolesSummary(roles?: RoleStat[]): string {
  if (!roles || roles.length === 0) return "—";
  return roles
    .slice(0, 2)
    .map((r) => `${roleLabel(r.role)} ${r.pct}%`)
    .join(" · ");
}

/**
 * Whether a win-rate gap exceeds sampling noise. Over a small window a 1–2 game
 * swing is meaningless; require the gap (in points) to clear ~1 standard error
 * of a coin-flip win rate over the smaller sample before treating either player
 * as actually ahead.
 */
export function winRateMeaningful(a: WindowStat, b: WindowStat): boolean {
  const na = a.games ?? 0;
  const nb = b.games ?? 0;
  if (na === 0 || nb === 0) return false;
  const gap = Math.abs((a.winRate ?? 0) - (b.winRate ?? 0));
  return gap > 50 / Math.sqrt(Math.min(na, nb));
}

/** Game counts per role pill: the role's full sample, and totalGames for "All". */
export function roleCounts(player: PlayerPayload): Record<string, number> {
  const counts: Record<string, number> = { ALL: player.totalGames ?? 0 };
  for (const r of player.availableRoles ?? []) {
    const windows = player.byRole?.[r];
    counts[r] = windows ? Math.max(0, ...Object.values(windows).map((w) => w.games ?? 0)) : 0;
  }
  return counts;
}
