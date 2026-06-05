import { tool } from "ai";
import { z } from "zod";

/**
 * Riot Games API client + agent tools.
 *
 * Riot uses two routing schemes:
 *  - PLATFORM routing (na1, euw1, kr, ...) for summoner-v4 / league-v4
 *  - REGIONAL routing (americas, europe, asia) for account-v1 / match-v5
 *
 * Docs: https://developer.riotgames.com/apis
 */

const PLATFORM_TO_REGION: Record<string, "americas" | "europe" | "asia"> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
};

const PLATFORMS = Object.keys(PLATFORM_TO_REGION) as [string, ...string[]];

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
      // type=ranked returns only ranked Summoner's Rift queues (Solo/Duo 420 + Flex 440).
      const ids = await riotFetch<string[]>(
        routing,
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&type=ranked`,
      );

      const matches = (
        await Promise.all(
          ids.map(async (id) => {
            const m = await riotFetch<MatchDto>(routing, `/lol/match/v5/matches/${id}`);
            // Defensive: keep only Ranked Solo/Duo (420) and Flex (440).
            if (m.info.queueId !== 420 && m.info.queueId !== 440) return null;
            const p = m.info.participants.find((x) => x.puuid === puuid)!;
            const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
            const mins = m.info.gameDuration / 60;
            return {
              matchId: id,
              champion: p.championName,
              role: p.teamPosition || "UNKNOWN",
              result: p.win ? "Win" : "Loss",
              kda: `${p.kills}/${p.deaths}/${p.assists}`,
              kdaRatio: Number(((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)),
              cs,
              csPerMin: Number((cs / mins).toFixed(1)),
              gold: p.goldEarned,
              queue: QUEUE_NAMES[m.info.queueId] ?? `Queue ${m.info.queueId}`,
              durationMin: Math.round(mins),
            };
          }),
        )
      ).filter((m): m is NonNullable<typeof m> => m !== null);

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
};
