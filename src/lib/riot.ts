import { tool } from "ai";
import { z } from "zod";
import { PLATFORM_TO_REGION, PLATFORMS } from "@/lib/regions";
import { pctVsRoleAvg } from "@/lib/roleBaselines";

/**
 * Riot Games API client + agent tools.
 *
 * Routing tables (PLATFORM vs REGIONAL) live in src/lib/regions.ts so the
 * client-side region picker can share them.
 *
 * Docs: https://developer.riotgames.com/apis
 */

// Common queueId -> human label (https://static.developer.riotgames.com/docs/lol/queues.json)
const QUEUE_NAMES: Record<number, string> = {
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  490: "Quickplay",
  700: "Clash",
  900: "ARURF",
  1700: "Arena",
};

class RiotError extends Error {}

function apiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    throw new RiotError(
      "RIOT_API_KEY is not set. Get a key at https://developer.riotgames.com and add it to .env.local",
    );
  }
  return key;
}

async function riotFetch<T>(host: string, path: string): Promise<T> {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-Riot-Token": apiKey() },
    // Riot data changes slowly; let Vercel cache identical calls briefly.
    next: { revalidate: 60 },
  });

  if (res.status === 404) {
    throw new RiotError("Not found — check the Riot ID and region.");
  }
  if (res.status === 429) {
    throw new RiotError("Rate limited by Riot. Wait a moment and try again.");
  }
  if (res.status === 403) {
    throw new RiotError(
      "Riot rejected the API key (403). Development keys expire every 24h — regenerate it at developer.riotgames.com.",
    );
  }
  if (!res.ok) {
    throw new RiotError(`Riot API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function parseRiotId(riotId: string): { gameName: string; tagLine: string } {
  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    throw new RiotError(
      `Invalid Riot ID "${riotId}". Use the format Name#TAG, e.g. "Faker#KR1".`,
    );
  }
  return { gameName: gameName.trim(), tagLine: tagLine.trim() };
}

async function resolvePuuid(riotId: string, region: string): Promise<string> {
  const { gameName, tagLine } = parseRiotId(riotId);
  if (!PLATFORM_TO_REGION[region]) {
    throw new RiotError(`Unknown region "${region}". Use one of: ${PLATFORMS.join(", ")}.`);
  }
  const routing = `${PLATFORM_TO_REGION[region]}.api.riotgames.com`;
  const account = await riotFetch<{ puuid: string }>(
    routing,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  );
  return account.puuid;
}

// ---- Types (only the fields we use) ----
interface SummonerDto {
  summonerLevel: number;
  profileIconId: number;
}
interface LeagueEntryDto {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}
interface MatchDto {
  info: {
    gameDuration: number;
    queueId: number;
    gameCreation: number;
    participants: Array<{
      puuid: string;
      championName: string;
      kills: number;
      deaths: number;
      assists: number;
      win: boolean;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      goldEarned: number;
      totalDamageDealtToChampions: number;
      // teamPosition is Riot's behavioral lane inference, but it's only filled
      // when all 5 team positions resolve uniquely — off-meta comps (e.g. Vayne
      // mid) often blank it. individualPosition is the per-player best guess and
      // stays populated in those cases, so we fall back to it. Neither is the
      // *queued* role (champ-select assignment is not exposed by match-v5).
      teamPosition: string;
      individualPosition: string;
      teamId: number;
    }>;
  };
}

const regionField = z
  .enum(PLATFORMS)
  .default("na1")
  .describe("Riot platform/region, e.g. na1, euw1, kr, br1");

// Lazily load + cache Data Dragon's numeric championId -> name map (for mastery).
let championMap: Promise<Map<number, string>> | null = null;
function getChampionMap(): Promise<Map<number, string>> {
  if (!championMap) {
    championMap = (async () => {
      const versions = (await (
        await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      ).json()) as string[];
      const data = (await (
        await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`,
        )
      ).json()) as { data: Record<string, { key: string }> };
      const map = new Map<number, string>();
      for (const [name, info] of Object.entries(data.data)) map.set(Number(info.key), name);
      return map;
    })().catch(() => new Map<number, string>());
  }
  return championMap;
}

// ---- Shared ranked-match fetching ----
/** Per-game stats for one player in one ranked Summoner's Rift match. */
interface GameStat {
  matchId: string;
  champion: string;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  durationMin: number;
  queueId: number;
  // Team-relative impact, derived from the player's 5-person team in the same
  // match. These are far more role-fair than raw CS/DPM: a support and an ADC
  // can both post high KP / damage share appropriate to their role.
  kp: number; // kill participation: (kills + assists) / team kills, 0..1
  damageShare: number; // share of team's champion damage, 0..1
  deathShare: number; // share of team's deaths, 0..1 (lower is better)
}

// Which ranked queue(s) a comparison or fetch is scoped to.
export type QueueMode = "solo" | "flex" | "both";
const QUEUE_ID: Record<Exclude<QueueMode, "both">, number> = { solo: 420, flex: 440 };

// Match-v5's ids endpoint accepts either a specific `queue` id or a `type`
// category — so for a single queue we ask Riot for exactly that queue, and the
// returned games are already scoped (no sparse-pool filtering needed). For
// "both" we fall back to `type=ranked`, which spans Solo/Duo + Flex.
function rankedIdsQuery(queueMode: QueueMode, count: number): string {
  const base = `start=0&count=${count}`;
  return queueMode === "both"
    ? `${base}&type=ranked`
    : `${base}&queue=${QUEUE_ID[queueMode]}`;
}

// Match details are immutable and, in a 5-stack, shared across teammates — so a
// team overview would otherwise refetch the same game once per player. We cache
// each MatchDto by id and share the in-flight promise, collapsing those
// duplicates into a single Riot call. Bounded with simple LRU eviction so a
// long-lived (Fluid Compute) instance doesn't grow without limit; failed
// fetches are evicted so they can be retried.
const MATCH_CACHE_MAX = 500;
const matchCache = new Map<string, Promise<MatchDto>>();

function fetchMatch(routing: string, id: string): Promise<MatchDto> {
  const cached = matchCache.get(id);
  if (cached) {
    // Bump recency for LRU.
    matchCache.delete(id);
    matchCache.set(id, cached);
    return cached;
  }
  const p = riotFetch<MatchDto>(routing, `/lol/match/v5/matches/${id}`);
  matchCache.set(id, p);
  // Don't cache failures — drop so a later call can retry.
  p.catch(() => matchCache.delete(id));
  if (matchCache.size > MATCH_CACHE_MAX) {
    const oldest = matchCache.keys().next().value;
    if (oldest !== undefined) matchCache.delete(oldest);
  }
  return p;
}

/**
 * Fetch a player's recent RANKED Summoner's Rift games as raw per-game stats,
 * scoped to the requested queue ("solo" = 420, "flex" = 440, "both" = either).
 * Individual match fetches that fail (e.g. transient rate limit) are dropped
 * rather than failing the whole batch.
 */
async function fetchRankedGames(
  puuid: string,
  routing: string,
  count: number,
  queueMode: QueueMode = "both",
): Promise<GameStat[]> {
  const ids = await riotFetch<string[]>(
    routing,
    `/lol/match/v5/matches/by-puuid/${puuid}/ids?${rankedIdsQuery(queueMode, count)}`,
  );

  const games = await Promise.all(
    ids.map(async (id) => {
      try {
        const m = await fetchMatch(routing, id);
        // Defensive: keep only Ranked Solo/Duo (420) and Flex (440).
        if (m.info.queueId !== 420 && m.info.queueId !== 440) return null;
        const p = m.info.participants.find((x) => x.puuid === puuid);
        if (!p) return null;
        // Sum the player's own team to derive team-relative impact metrics.
        const team = m.info.participants.filter((x) => x.teamId === p.teamId);
        const teamKills = team.reduce((s, x) => s + x.kills, 0);
        const teamDeaths = team.reduce((s, x) => s + x.deaths, 0);
        const teamDamage = team.reduce((s, x) => s + x.totalDamageDealtToChampions, 0);
        return {
          matchId: id,
          champion: p.championName,
          role: p.teamPosition || p.individualPosition || "UNKNOWN",
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          gold: p.goldEarned,
          damage: p.totalDamageDealtToChampions,
          durationMin: m.info.gameDuration / 60,
          queueId: m.info.queueId,
          kp: teamKills > 0 ? (p.kills + p.assists) / teamKills : 0,
          damageShare: teamDamage > 0 ? p.totalDamageDealtToChampions / teamDamage : 0,
          deathShare: teamDeaths > 0 ? p.deaths / teamDeaths : 0,
        } satisfies GameStat;
      } catch {
        return null;
      }
    }),
  );

  return games.filter((g): g is GameStat => g !== null);
}

// ---- Player comparison ----
// We fetch this many recent ranked games per player, then pre-compute aggregate
// stats for each window so the UI can toggle between them with no refetch.
const COMPARE_GAME_COUNT = 50;
const COMPARE_WINDOWS = [10, 25, 50] as const;
// A role view is only offered when the player has at least this many games in it
// across the fetched pool — below this the per-game averages are pure noise.
const MIN_ROLE_GAMES = 5;

/** Per-game KDA ratio, used for consistency + form. */
const gameKda = (g: GameStat) => (g.kills + g.assists) / Math.max(1, g.deaths);

/** Win rate (%) of a games slice; 0 for an empty slice. */
const winRateOf = (gs: GameStat[]) =>
  gs.length ? Math.round((gs.filter((g) => g.win).length / gs.length) * 100) : 0;

/**
 * Form: recent half vs older half of the window (games are recency-ordered,
 * so index 0 is the most recent). "up"/"down" only when the win-rate swing is
 * meaningful (>10 pts) AND there are enough games to mean something.
 */
function computeForm(games: GameStat[]) {
  const n = games.length;
  if (n < 4) return undefined;
  const half = Math.floor(n / 2);
  const recent = games.slice(0, half);
  const prior = games.slice(half);
  const recentWinRate = winRateOf(recent);
  const priorWinRate = winRateOf(prior);
  const diff = recentWinRate - priorWinRate;
  const trend = diff > 10 ? "up" : diff < -10 ? "down" : "flat";
  return { recentWinRate, priorWinRate, trend } as const;
}

/** Aggregate a slice of a player's games into averages + a champion pool. */
function aggregateWindow(games: GameStat[]) {
  const n = games.length;
  if (n === 0) return { games: 0 };

  const wins = games.filter((g) => g.win).length;
  const totals = games.reduce(
    (a, g) => {
      a.kills += g.kills;
      a.deaths += g.deaths;
      a.assists += g.assists;
      a.cs += g.cs;
      a.gold += g.gold;
      a.damage += g.damage;
      a.minutes += g.durationMin;
      a.kp += g.kp;
      a.damageShare += g.damageShare;
      a.deathShare += g.deathShare;
      return a;
    },
    { kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, damage: 0, minutes: 0, kp: 0, damageShare: 0, deathShare: 0 },
  );

  // Role distribution — which positions the player actually queued, most-played
  // first. Lets the model (and card) compare like-for-like instead of guessing.
  const roleCount = new Map<string, number>();
  for (const g of games) {
    if (g.role && g.role !== "UNKNOWN") roleCount.set(g.role, (roleCount.get(g.role) ?? 0) + 1);
  }
  const roles = [...roleCount.entries()]
    .map(([role, count]) => ({ role, games: count, pct: Math.round((count / n) * 100) }))
    .sort((a, b) => b.games - a.games);
  const primaryRole = roles[0]?.role ?? "UNKNOWN";

  // Per-champion detail: not just games + WR, but role-relative per-game impact
  // (KDA, CS/min, DPM, KP, damage/death share vs role average). This lets the
  // model rank a player's champions on substance rather than a noisy small-sample
  // win rate. Mirrors the window's shape, incl. vsRoleAvg, using the role the
  // player actually plays that champion in (not the window's primary role).
  const byChamp = new Map<
    string,
    {
      games: number; wins: number; k: number; d: number; a: number; cs: number;
      mins: number; damage: number; kp: number; damageShare: number; deathShare: number;
      roles: Map<string, number>;
    }
  >();
  for (const g of games) {
    const c =
      byChamp.get(g.champion) ??
      { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, mins: 0, damage: 0, kp: 0, damageShare: 0, deathShare: 0, roles: new Map<string, number>() };
    c.games += 1;
    if (g.win) c.wins += 1;
    c.k += g.kills;
    c.d += g.deaths;
    c.a += g.assists;
    c.cs += g.cs;
    c.mins += g.durationMin;
    c.damage += g.damage;
    c.kp += g.kp;
    c.damageShare += g.damageShare;
    c.deathShare += g.deathShare;
    if (g.role && g.role !== "UNKNOWN") c.roles.set(g.role, (c.roles.get(g.role) ?? 0) + 1);
    byChamp.set(g.champion, c);
  }
  const topChampions = [...byChamp.entries()]
    .map(([champion, v]) => {
      // Role the player actually plays this champion in (falls back to the
      // window's primary role), so vsRoleAvg compares against the right baseline.
      const champRole = [...v.roles.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? primaryRole;
      const champMins = Math.max(1, v.mins);
      const csPerMin = Number((v.cs / champMins).toFixed(1));
      const dpm = Math.round(v.damage / champMins);
      const kp = Math.round((v.kp / v.games) * 100);
      const damageShare = Math.round((v.damageShare / v.games) * 100);
      const deathShare = Math.round((v.deathShare / v.games) * 100);
      return {
        champion,
        games: v.games,
        winRate: Math.round((v.wins / v.games) * 100),
        role: champRole,
        kda: Number(((v.k + v.a) / Math.max(1, v.d)).toFixed(2)),
        csPerMin,
        dpm,
        kp,
        damageShare,
        deathShare,
        vsRoleAvg: {
          csPerMin: pctVsRoleAvg(champRole, "csPerMin", csPerMin),
          damageShare: pctVsRoleAvg(champRole, "damageShare", damageShare),
          dpm: pctVsRoleAvg(champRole, "dpm", dpm),
          kp: pctVsRoleAvg(champRole, "kp", kp),
          deathShare: pctVsRoleAvg(champRole, "deathShare", deathShare),
        },
      };
    })
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  // Consistency: standard deviation of per-game KDA. Lower = steadier; a high
  // value flags a feast-or-famine player whose averages hide big swings.
  const kdas = games.map(gameKda);
  const meanKda = kdas.reduce((s, v) => s + v, 0) / n;
  const kdaStdev = Number(
    Math.sqrt(kdas.reduce((s, v) => s + (v - meanKda) ** 2, 0) / n).toFixed(2),
  );

  const mins = Math.max(1, totals.minutes);
  const csPerMin = Number((totals.cs / mins).toFixed(1));
  const dpm = Math.round(totals.damage / mins);
  const goldPerMin = Math.round(totals.gold / mins);
  // Team-relative impact (window means of per-game ratios), as percentages.
  const kp = Math.round((totals.kp / n) * 100);
  const damageShare = Math.round((totals.damageShare / n) * 100);
  const deathShare = Math.round((totals.deathShare / n) * 100);

  // Role-relative deviations so the model's prose matches the card's fair view:
  // role-dependent stats are only meaningful against the player's role average.
  const vsRoleAvg = {
    kp: pctVsRoleAvg(primaryRole, "kp", kp),
    damageShare: pctVsRoleAvg(primaryRole, "damageShare", damageShare),
    csPerMin: pctVsRoleAvg(primaryRole, "csPerMin", csPerMin),
    dpm: pctVsRoleAvg(primaryRole, "dpm", dpm),
    goldPerMin: pctVsRoleAvg(primaryRole, "goldPerMin", goldPerMin),
    deathShare: pctVsRoleAvg(primaryRole, "deathShare", deathShare),
  };

  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: Math.round((wins / n) * 100),
    primaryRole,
    roles,
    // KDA aggregated across the window (standard "(K+A)/D" definition).
    kda: Number(((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2)),
    kdaStdev,
    kills: Number((totals.kills / n).toFixed(1)),
    deaths: Number((totals.deaths / n).toFixed(1)),
    assists: Number((totals.assists / n).toFixed(1)),
    csPerMin,
    dpm,
    goldPerMin,
    kp,
    damageShare,
    deathShare,
    vsRoleAvg,
    form: computeForm(games),
    topChampions,
  };
}

/** Pre-aggregate a recency-ordered games slice into each requested window,
 *  keyed by window size as a string ("10" → last 10 of these games). Shared by
 *  the all-roles view, every per-role view, and the team card so they all stay
 *  perfectly in sync. */
function windowedStats(
  games: GameStat[],
  windows: readonly number[] = COMPARE_WINDOWS,
): Record<string, ReturnType<typeof aggregateWindow>> {
  const out: Record<string, ReturnType<typeof aggregateWindow>> = {};
  for (const w of windows) out[String(w)] = aggregateWindow(games.slice(0, w));
  return out;
}

/** A player's rank string for the queue being read, e.g. "GOLD II · 45 LP".
 *  "both" shows the Solo/Duo rank. "Unranked" when no entry exists. */
function resolveRankString(entries: LeagueEntryDto[], queueMode: QueueMode): string {
  const rankQueue = queueMode === "flex" ? "RANKED_FLEX_SR" : "RANKED_SOLO_5x5";
  const entry = entries.find((e) => e.queueType === rankQueue);
  return entry ? `${entry.tier} ${entry.rank} · ${entry.leaguePoints} LP` : "Unranked";
}

// ---- Team overview ----
// A team overview fetches 2–5 players at once. Naively that's 5× the
// comparison's call volume, but fetchMatch() dedupes shared games — and in a
// 5-stack teammates share most of their recent matches — so the real call count
// is far lower and team mode can read the same depth as a 1v1 comparison.
// Mastery is a single pre-aggregated call per player regardless of game count,
// so we pull a deep pool there for richer draft suggestions.
const TEAM_GAME_COUNT = 25;
const TEAM_WINDOWS = [10, 25] as const;
const TEAM_MASTERY_COUNT = 12;
const ROLE_SLOTS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

/** Games played + win rate per role across the fetched window. Drives the
 *  suggested role assignment: a player slots best into a role they actually
 *  play and win on — never the one their champion implies. */
interface RoleRecord {
  games: number;
  winRate: number;
}
function computeRoleAffinity(games: GameStat[]): Record<string, RoleRecord> {
  const acc = new Map<string, { games: number; wins: number }>();
  for (const g of games) {
    if (!g.role || g.role === "UNKNOWN") continue;
    const e = acc.get(g.role) ?? { games: 0, wins: 0 };
    e.games += 1;
    if (g.win) e.wins += 1;
    acc.set(g.role, e);
  }
  const out: Record<string, RoleRecord> = {};
  for (const [role, v] of acc) {
    out[role] = { games: v.games, winRate: Math.round((v.wins / v.games) * 100) };
  }
  return out;
}

/** The role a player plays most (their natural position), or UNKNOWN. */
function topAffinityRole(aff: Record<string, RoleRecord>): string {
  let role = "UNKNOWN";
  let most = -1;
  for (const [r, v] of Object.entries(aff)) {
    if (v.games > most) {
      most = v.games;
      role = r;
    }
  }
  return role;
}

/** A player's fit for a role: games dominate, win rate is a gentle tie-break.
 *  Zero when they've never played it, so the optimizer avoids off-role fills. */
function roleFit(aff: Record<string, RoleRecord>, role: string): number {
  const r = aff[role];
  return r ? r.games + r.winRate / 100 : 0;
}

/** All orderings of an array (n! — only ever called with the 5 role slots). */
function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permute(rest)) out.push([item, ...p]);
  });
  return out;
}

/** Fetch + summarize one player for the comparison card. */
async function buildPlayerSummary(riotId: string, region: string, queueMode: QueueMode) {
  const puuid = await resolvePuuid(riotId, region);
  const host = `${region}.api.riotgames.com`;
  const routing = `${PLATFORM_TO_REGION[region]}.api.riotgames.com`;
  const [summoner, entries, games] = await Promise.all([
    riotFetch<SummonerDto>(host, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
    riotFetch<LeagueEntryDto[]>(host, `/lol/league/v4/entries/by-puuid/${puuid}`),
    fetchRankedGames(puuid, routing, COMPARE_GAME_COUNT, queueMode),
  ]);

  // Show the rank for the queue being compared; "both" defaults to Solo/Duo.
  const rank = resolveRankString(entries, queueMode);

  // The all-roles aggregate, pre-computed per window (the default "All" view).
  const stats = windowedStats(games);

  // Per-role breakdowns, pre-computed the same way so the card can toggle a
  // player to a single role (e.g. their Mid games) with no refetch — mirroring
  // the per-window pre-compute above. Games stay recency-ordered, so each role
  // slice is that role's most-recent games. Only roles with a real sample are
  // offered; UNKNOWN (Riot couldn't infer a position) is never a role view.
  const gamesByRole = new Map<string, GameStat[]>();
  for (const g of games) {
    if (!g.role || g.role === "UNKNOWN") continue;
    const bucket = gamesByRole.get(g.role);
    if (bucket) bucket.push(g);
    else gamesByRole.set(g.role, [g]);
  }
  const byRole: Record<string, ReturnType<typeof windowedStats>> = {};
  for (const [role, roleGames] of gamesByRole) {
    if (roleGames.length >= MIN_ROLE_GAMES) byRole[role] = windowedStats(roleGames);
  }
  // Most-played role first, so the card renders the toggle pills in that order.
  const availableRoles = Object.keys(byRole).sort(
    (a, b) => (gamesByRole.get(b)?.length ?? 0) - (gamesByRole.get(a)?.length ?? 0),
  );

  return {
    riotId,
    region,
    summonerLevel: summoner.summonerLevel,
    rank,
    totalGames: games.length,
    stats,
    byRole,
    availableRoles,
  };
}

/** Fetch + summarize one player for the team overview: the comparison summary
 *  (rank, windowed stats, recency champ pool, role split) plus an all-time
 *  mastery pool and per-role affinity for assignment. */
async function buildTeamPlayerSummary(riotId: string, region: string, queueMode: QueueMode) {
  const puuid = await resolvePuuid(riotId, region);
  const host = `${region}.api.riotgames.com`;
  const routing = `${PLATFORM_TO_REGION[region]}.api.riotgames.com`;
  const [summoner, entries, games, masteryEntries, champNames] = await Promise.all([
    riotFetch<SummonerDto>(host, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
    riotFetch<LeagueEntryDto[]>(host, `/lol/league/v4/entries/by-puuid/${puuid}`),
    fetchRankedGames(puuid, routing, TEAM_GAME_COUNT, queueMode),
    riotFetch<Array<{ championId: number; championLevel: number; championPoints: number }>>(
      host,
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${TEAM_MASTERY_COUNT}`,
    ),
    getChampionMap(),
  ]);

  // Show the rank for the queue being read; "both" defaults to Solo/Duo.
  const rank = resolveRankString(entries, queueMode);

  const stats = windowedStats(games, TEAM_WINDOWS);

  const mastery = masteryEntries.map((e) => ({
    champion: champNames.get(e.championId) ?? `Champion ${e.championId}`,
    level: e.championLevel,
    points: e.championPoints,
  }));

  return {
    riotId,
    region,
    summonerLevel: summoner.summonerLevel,
    rank,
    totalGames: games.length,
    stats,
    mastery,
    roleAffinity: computeRoleAffinity(games),
  };
}

type TeamPlayerSummary = Awaited<ReturnType<typeof buildTeamPlayerSummary>>;

/** Brute-force the best role assignment: each player gets a distinct role,
 *  maximizing total role fit. Only ever 5! = 120 permutations. With fewer than
 *  5 players some roles stay empty; the optimizer still seats everyone where
 *  they fit best. Each row notes the player's natural role + games on the
 *  assigned one, so the card/agent can flag off-role fills. */
function assignRoles(players: TeamPlayerSummary[]) {
  let best: { score: number; perm: readonly string[] } = {
    score: -Infinity,
    perm: ROLE_SLOTS,
  };
  for (const perm of permute(ROLE_SLOTS)) {
    let score = 0;
    players.forEach((p, i) => {
      if (i < perm.length) score += roleFit(p.roleAffinity, perm[i]);
    });
    if (score > best.score) best = { score, perm };
  }
  return players.map((p, i) => {
    const role = best.perm[i] ?? "UNKNOWN";
    return {
      riotId: p.riotId,
      role,
      gamesInRole: p.roleAffinity[role]?.games ?? 0,
      primaryRole: topAffinityRole(p.roleAffinity),
    };
  });
}

/** Tools the agent can call for player account & match data. */
export const riotTools = {
  lookupSummoner: tool({
    description:
      "Look up a League of Legends player's profile and ranked standing (tier, LP, win rate) by Riot ID. Use this first when a user asks about a specific player.",
    inputSchema: z.object({
      riotId: z.string().describe('Riot ID in "Name#TAG" format, e.g. "Faker#KR1"'),
      region: regionField,
    }),
    execute: async ({ riotId, region }) => {
      const puuid = await resolvePuuid(riotId, region);
      const host = `${region}.api.riotgames.com`;
      const [summoner, entries] = await Promise.all([
        riotFetch<SummonerDto>(host, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
        riotFetch<LeagueEntryDto[]>(host, `/lol/league/v4/entries/by-puuid/${puuid}`),
      ]);

      const ranked = entries.map((e) => {
        const games = e.wins + e.losses;
        return {
          queue: e.queueType === "RANKED_SOLO_5x5" ? "Solo/Duo" : e.queueType === "RANKED_FLEX_SR" ? "Flex" : e.queueType,
          rank: `${e.tier} ${e.rank}`,
          leaguePoints: e.leaguePoints,
          wins: e.wins,
          losses: e.losses,
          winRate: games ? `${Math.round((e.wins / games) * 100)}%` : "N/A",
        };
      });

      return {
        riotId,
        region,
        summonerLevel: summoner.summonerLevel,
        ranked: ranked.length ? ranked : "Unranked",
      };
    },
  }),

  getMatchHistory: tool({
    description:
      "Get a player's recent RANKED Summoner's Rift games (Solo/Duo and Flex only — ARAM, normals, and other modes are excluded) with per-game stats (champion, role, K/D/A, CS, win/loss, queue). Use to analyze recent ranked performance and trends.",
    inputSchema: z.object({
      riotId: z.string().describe('Riot ID in "Name#TAG" format'),
      region: regionField,
      count: z.number().int().min(1).max(10).default(5).describe("How many recent ranked games to fetch"),
    }),
    execute: async ({ riotId, region, count }) => {
      const puuid = await resolvePuuid(riotId, region);
      const routing = `${PLATFORM_TO_REGION[region]}.api.riotgames.com`;
      const games = await fetchRankedGames(puuid, routing, count);

      const matches = games.map((g) => ({
        matchId: g.matchId,
        champion: g.champion,
        role: g.role,
        result: g.win ? "Win" : "Loss",
        kda: `${g.kills}/${g.deaths}/${g.assists}`,
        kdaRatio: Number(((g.kills + g.assists) / Math.max(1, g.deaths)).toFixed(2)),
        cs: g.cs,
        csPerMin: Number((g.cs / g.durationMin).toFixed(1)),
        gold: g.gold,
        queue: QUEUE_NAMES[g.queueId] ?? `Queue ${g.queueId}`,
        durationMin: Math.round(g.durationMin),
      }));

      return { riotId, region, matches };
    },
  }),

  getChampionMastery: tool({
    description:
      "Get a player's most-mastered champions (mastery level and points). Useful for understanding their champion pool and main role.",
    inputSchema: z.object({
      riotId: z.string().describe('Riot ID in "Name#TAG" format'),
      region: regionField,
      count: z.number().int().min(1).max(15).default(10).describe("How many top champions to return"),
    }),
    execute: async ({ riotId, region, count }) => {
      const puuid = await resolvePuuid(riotId, region);
      const host = `${region}.api.riotgames.com`;
      const [entries, names] = await Promise.all([
        riotFetch<Array<{ championId: number; championLevel: number; championPoints: number }>>(
          host,
          `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
        ),
        getChampionMap(),
      ]);
      const top = entries.map((e) => ({
        champion: names.get(e.championId) ?? `Champion ${e.championId}`,
        level: e.championLevel,
        points: e.championPoints,
      }));
      return { riotId, region, top };
    },
  }),

  analyzePlayerStats: tool({
    description:
      'Aggregate ONE player\'s recent RANKED Summoner\'s Rift performance into a visual overview card with a radar chart. Set queue to scope it: "solo" = Ranked Solo/Duo, "flex" = Ranked Flex, "both" = combined (default). Returns the player\'s rank plus aggregated averages — win rate, KDA, kill participation, damage share, CS/min, DPM, gold/min, survivability (death share), role split, and most-played champions — pre-computed over their last 10, 25, and 50 games. The card also lets the user interactively filter to a single role (e.g. only their Mid games). Use this when a user asks to analyze, review, or check how a SINGLE player is performing. For a head-to-head between two players use comparePlayerStats instead.',
    inputSchema: z.object({
      player: z.object({
        riotId: z.string().describe('Riot ID in "Name#TAG" format'),
        region: regionField,
      }),
      queue: z
        .enum(["solo", "flex", "both"])
        .default("both")
        .describe('Which ranked queue to analyze: "solo", "flex", or "both" (default).'),
    }),
    execute: async ({ player, queue }) => {
      const summary = await buildPlayerSummary(player.riotId, player.region, queue);
      return { queue, windows: COMPARE_WINDOWS.map(String), player: summary };
    },
  }),

  comparePlayerStats: tool({
    description:
      'Compare two League of Legends players side by side across their recent RANKED Summoner\'s Rift games. Set queue to scope the comparison: "solo" = Ranked Solo/Duo only, "flex" = Ranked Flex only, "both" = Solo/Duo + Flex combined (default). Returns each player\'s rank (for the chosen queue) plus aggregated averages — win rate, KDA, CS/min, damage per minute (DPM), gold per minute, and most-played champions — pre-computed over their last 10, 25, and 50 games of that queue. The card lets the user interactively filter EACH player to a single role independently (e.g. compare player A\'s Mid games vs player B\'s ADC games). Use this whenever the user asks to compare, contrast, or pit two players against each other. The two players may be on different regions.',
    inputSchema: z.object({
      playerA: z.object({
        riotId: z.string().describe('Riot ID in "Name#TAG" format'),
        region: regionField,
      }),
      playerB: z.object({
        riotId: z.string().describe('Riot ID in "Name#TAG" format'),
        region: regionField,
      }),
      queue: z
        .enum(["solo", "flex", "both"])
        .default("both")
        .describe('Which ranked queue to compare: "solo", "flex", or "both" (default).'),
    }),
    execute: async ({ playerA, playerB, queue }) => {
      const [a, b] = await Promise.all([
        buildPlayerSummary(playerA.riotId, playerA.region, queue),
        buildPlayerSummary(playerB.riotId, playerB.region, queue),
      ]);
      return { queue, windows: COMPARE_WINDOWS.map(String), players: [a, b] };
    },
  }),

  analyzeTeam: tool({
    description:
      'Build a TEAM OVERVIEW for 2–5 League of Legends players to help them draft together. Fetches each player\'s recent RANKED Summoner\'s Rift role distribution, per-role affinity (games + win rate), recency champion pool, and all-time champion mastery, then returns a deterministic SUGGESTED role assignment for the group plus any bans / known enemy picks the user supplied. Use this whenever the user wants to plan a team or 5-stack — assign roles, decide who plays what champion, or analyze a team composition. Set queue to "solo", "flex", or "both" (default). After it returns, present the role assignment, recommend per-role champion picks from each player\'s pool weighted by the current meta, and analyze the resulting composition. Renders a team card, so keep prose tight.',
    inputSchema: z.object({
      players: z
        .array(
          z.object({
            riotId: z.string().describe('Riot ID in "Name#TAG" format'),
            region: regionField,
          }),
        )
        .min(2)
        .max(5)
        .describe("The 2–5 players on the team, each with a Riot ID and region"),
      queue: z
        .enum(["solo", "flex", "both"])
        .default("both")
        .describe('Which ranked queue to read each player from: "solo", "flex", or "both" (default).'),
      bans: z
        .array(z.string())
        .optional()
        .describe("Champion names that are banned / unavailable for this draft, if any"),
      enemy: z
        .array(z.string())
        .optional()
        .describe("Known enemy team champion picks, by name, if any"),
    }),
    execute: async ({ players, queue, bans, enemy }) => {
      const summaries = await Promise.all(
        players.map((p) => buildTeamPlayerSummary(p.riotId, p.region, queue)),
      );
      return {
        queue,
        windows: TEAM_WINDOWS.map(String),
        players: summaries,
        assignment: assignRoles(summaries),
        bans: bans ?? [],
        enemy: enemy ?? [],
      };
    },
  }),
};
