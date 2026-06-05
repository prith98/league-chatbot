import { tool } from "ai";
import { z } from "zod";
import { PLATFORM_TO_REGION, PLATFORMS } from "@/lib/regions";

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
      teamPosition: string;
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
}

/**
 * Fetch a player's recent RANKED Summoner's Rift games (Solo/Duo 420 + Flex 440)
 * as raw per-game stats. Individual match fetches that fail (e.g. transient rate
 * limit) are dropped rather than failing the whole batch.
 */
async function fetchRankedGames(
  puuid: string,
  routing: string,
  count: number,
): Promise<GameStat[]> {
  // type=ranked returns only ranked Summoner's Rift queues (Solo/Duo + Flex).
  const ids = await riotFetch<string[]>(
    routing,
    `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&type=ranked`,
  );

  const games = await Promise.all(
    ids.map(async (id) => {
      try {
        const m = await riotFetch<MatchDto>(routing, `/lol/match/v5/matches/${id}`);
        // Defensive: keep only Ranked Solo/Duo (420) and Flex (440).
        if (m.info.queueId !== 420 && m.info.queueId !== 440) return null;
        const p = m.info.participants.find((x) => x.puuid === puuid);
        if (!p) return null;
        return {
          matchId: id,
          champion: p.championName,
          role: p.teamPosition || "UNKNOWN",
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          gold: p.goldEarned,
          damage: p.totalDamageDealtToChampions,
          durationMin: m.info.gameDuration / 60,
          queueId: m.info.queueId,
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
const COMPARE_GAME_COUNT = 25;
const COMPARE_WINDOWS = [10, 20, 25] as const;

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
      return a;
    },
    { kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, damage: 0, minutes: 0 },
  );

  const byChamp = new Map<string, { games: number; wins: number }>();
  for (const g of games) {
    const c = byChamp.get(g.champion) ?? { games: 0, wins: 0 };
    c.games += 1;
    if (g.win) c.wins += 1;
    byChamp.set(g.champion, c);
  }
  const topChampions = [...byChamp.entries()]
    .map(([champion, v]) => ({
      champion,
      games: v.games,
      winRate: Math.round((v.wins / v.games) * 100),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);

  const mins = Math.max(1, totals.minutes);
  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: Math.round((wins / n) * 100),
    // KDA aggregated across the window (standard "(K+A)/D" definition).
    kda: Number(((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2)),
    kills: Number((totals.kills / n).toFixed(1)),
    deaths: Number((totals.deaths / n).toFixed(1)),
    assists: Number((totals.assists / n).toFixed(1)),
    csPerMin: Number((totals.cs / mins).toFixed(1)),
    dpm: Math.round(totals.damage / mins),
    goldPerMin: Math.round(totals.gold / mins),
    topChampions,
  };
}

/** Fetch + summarize one player for the comparison card. */
async function buildPlayerSummary(riotId: string, region: string) {
  const puuid = await resolvePuuid(riotId, region);
  const host = `${region}.api.riotgames.com`;
  const routing = `${PLATFORM_TO_REGION[region]}.api.riotgames.com`;
  const [summoner, entries, games] = await Promise.all([
    riotFetch<SummonerDto>(host, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
    riotFetch<LeagueEntryDto[]>(host, `/lol/league/v4/entries/by-puuid/${puuid}`),
    fetchRankedGames(puuid, routing, COMPARE_GAME_COUNT),
  ]);

  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const rank = solo ? `${solo.tier} ${solo.rank} · ${solo.leaguePoints} LP` : "Unranked";

  const stats: Record<string, ReturnType<typeof aggregateWindow>> = {};
  for (const w of COMPARE_WINDOWS) stats[String(w)] = aggregateWindow(games.slice(0, w));

  return {
    riotId,
    region,
    summonerLevel: summoner.summonerLevel,
    rank,
    totalGames: games.length,
    stats,
  };
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
      count: z.number().int().min(1).max(10).default(5).describe("How many top champions to return"),
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

  comparePlayerStats: tool({
    description:
      "Compare two League of Legends players side by side across their recent RANKED Summoner's Rift games (Solo/Duo + Flex). Returns each player's rank plus aggregated averages — win rate, KDA, CS/min, damage per minute (DPM), gold per minute, and most-played champions — pre-computed over their last 10, 20, and 25 games. Use this whenever the user asks to compare, contrast, or pit two players against each other. The two players may be on different regions.",
    inputSchema: z.object({
      playerA: z.object({
        riotId: z.string().describe('Riot ID in "Name#TAG" format'),
        region: regionField,
      }),
      playerB: z.object({
        riotId: z.string().describe('Riot ID in "Name#TAG" format'),
        region: regionField,
      }),
    }),
    execute: async ({ playerA, playerB }) => {
      const [a, b] = await Promise.all([
        buildPlayerSummary(playerA.riotId, playerA.region),
        buildPlayerSummary(playerB.riotId, playerB.region),
      ]);
      return { windows: COMPARE_WINDOWS.map(String), players: [a, b] };
    },
  }),
};
