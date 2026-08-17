/**
 * Synthetic payloads for the visual preview route.
 *
 * Every name here is obviously fake (`#DEMO`) and no figure is taken from a
 * real account — the point is to exercise every report layout (long names,
 * missing metrics, empty windows, five-way overlays) without needing live keys
 * or burning Riot rate limit while iterating on design.
 */

import type { WindowStat } from "@/components/tools/types";

const win = (over: Partial<WindowStat> = {}): WindowStat => ({
  games: 50,
  wins: 29,
  losses: 21,
  winRate: 58,
  primaryRole: "MIDDLE",
  roles: [
    { role: "MIDDLE", games: 44, pct: 88 },
    { role: "TOP", games: 6, pct: 12 },
  ],
  kda: 4.21,
  kdaStdev: 1.8,
  kills: 8,
  deaths: 4,
  assists: 9,
  csPerMin: 8.4,
  dpm: 912,
  goldPerMin: 452,
  kp: 71,
  damageShare: 33,
  deathShare: 15,
  visionScore: 28,
  visionScorePerMin: 0.92,
  form: { recentWinRate: 62, priorWinRate: 54, trend: "up" },
  topChampions: [
    {
      champion: "Ahri",
      games: 14,
      winRate: 64,
      role: "MIDDLE",
      kda: 4.8,
      vsRoleAvg: { damageShare: "+22% vs avg", kp: "+9% vs avg", csPerMin: "+14% vs avg" },
    },
    {
      champion: "Orianna",
      games: 11,
      winRate: 55,
      role: "MIDDLE",
      kda: 3.9,
      vsRoleAvg: { damageShare: "+8% vs avg", kp: "+3% vs avg", csPerMin: "+19% vs avg" },
    },
    {
      champion: "Azir",
      games: 7,
      winRate: 43,
      role: "MIDDLE",
      kda: 2.6,
      vsRoleAvg: { damageShare: "-6% vs avg", kp: "-11% vs avg", csPerMin: "+21% vs avg" },
    },
  ],
  ...over,
});

const support = (over: Partial<WindowStat> = {}): WindowStat =>
  win({
    primaryRole: "UTILITY",
    roles: [{ role: "UTILITY", games: 50, pct: 100 }],
    winRate: 52,
    wins: 26,
    losses: 24,
    kda: 3.4,
    kills: 2,
    deaths: 6,
    assists: 18,
    csPerMin: 1.1,
    dpm: 288,
    goldPerMin: 236,
    kp: 72,
    damageShare: 10,
    deathShare: 24,
    visionScorePerMin: 2.4,
    topChampions: [
      {
        champion: "Thresh",
        games: 19,
        winRate: 58,
        role: "UTILITY",
        kda: 3.9,
        vsRoleAvg: { kp: "+14% vs avg", damageShare: "-9% vs avg" },
      },
      {
        champion: "Nautilus",
        games: 12,
        winRate: 46,
        role: "UTILITY",
        kda: 2.8,
        vsRoleAvg: { kp: "-4% vs avg", damageShare: "-12% vs avg" },
      },
    ],
    ...over,
  });

const player = (riotId: string, rank: string, base: WindowStat) => ({
  riotId,
  region: "na1",
  summonerLevel: 412,
  rank,
  totalGames: 50,
  stats: {
    "10": { ...base, games: 10, wins: 6, losses: 4, winRate: 60 },
    "15": { ...base, games: 15, wins: 8, losses: 7, winRate: 53 },
    "25": { ...base, games: 25, wins: 14, losses: 11, winRate: 56 },
    "50": base,
  },
  byRole: {
    [base.primaryRole ?? "MIDDLE"]: {
      "10": { ...base, games: 9, wins: 6, losses: 3, winRate: 67 },
      "25": { ...base, games: 22, wins: 13, losses: 9, winRate: 59 },
      "50": { ...base, games: 44, wins: 26, losses: 18, winRate: 59 },
    },
  },
  availableRoles: [base.primaryRole ?? "MIDDLE"],
});

export const PLAYER_FIXTURE = {
  windows: ["10", "25", "50"],
  queue: "solo",
  player: player("SampleMid#DEMO", "Diamond II · 41 LP", win()),
};

export const COMPARE_FIXTURE = {
  windows: ["10", "25", "50"],
  queue: "both",
  players: [
    player("SampleMid#DEMO", "Diamond II · 41 LP", win()),
    player("VeryLongSummonerName#DEMO", "Emerald I · 88 LP", support()),
  ],
};

export const TEAM_FIXTURE = {
  windows: ["10", "15"],
  queue: "flex",
  bans: ["Yuumi", "Zed", "Darius"],
  enemy: ["Malphite", "Ezreal"],
  players: [
    {
      ...player("SampleTop#DEMO", "Platinum IV · 12 LP", win({ primaryRole: "TOP", csPerMin: 7.1 })),
      mastery: [
        { champion: "Sett", level: 7, points: 214000 },
        { champion: "Darius", level: 6, points: 98000 },
      ],
    },
    {
      ...player("SampleJgl#DEMO", "Gold I · 66 LP", win({ primaryRole: "JUNGLE", csPerMin: 5.9 })),
      mastery: [{ champion: "Viego", level: 7, points: 302000 }],
    },
    {
      ...player("SampleMid#DEMO", "Diamond II · 41 LP", win()),
      mastery: [{ champion: "Ahri", level: 7, points: 411000 }],
    },
    {
      ...player("SampleAdc#DEMO", "Platinum II · 4 LP", win({ primaryRole: "BOTTOM", csPerMin: 8.9 })),
      mastery: [{ champion: "Jinx", level: 7, points: 256000 }],
    },
    {
      ...player("SampleSup#DEMO", "Gold III · 51 LP", support()),
      mastery: [{ champion: "Thresh", level: 7, points: 188000 }],
    },
  ],
  assignment: [
    { riotId: "SampleTop#DEMO", role: "TOP", gamesInRole: 38, primaryRole: "TOP" },
    { riotId: "SampleJgl#DEMO", role: "JUNGLE", gamesInRole: 41, primaryRole: "JUNGLE" },
    { riotId: "SampleMid#DEMO", role: "MIDDLE", gamesInRole: 44, primaryRole: "MIDDLE" },
    { riotId: "SampleAdc#DEMO", role: "BOTTOM", gamesInRole: 3, primaryRole: "MIDDLE" },
    { riotId: "SampleSup#DEMO", role: "UTILITY", gamesInRole: 0, primaryRole: "UNKNOWN" },
  ],
};

const together = (over: Partial<WindowStat>): WindowStat =>
  win({ games: 12, wins: 7, losses: 5, winRate: 58, ...over });

const mate = (riotId: string, rank: string, over: Partial<WindowStat>) => ({
  riotId,
  region: "euw1",
  summonerLevel: 288,
  rank,
  totalGames: 40,
  gamesTogether: 12,
  together: {
    all: together(over),
    wins: together({ ...over, games: 7, wins: 7, losses: 0, winRate: 100 }),
    losses: together({ ...over, games: 5, wins: 0, losses: 5, winRate: 0 }),
  },
  playedWith: [
    { riotId: "SquadTwo#DEMO", games: 12 },
    { riotId: "SquadThree#DEMO", games: 9 },
  ],
});

export const TEAMMATES_FIXTURE = {
  totalSharedMatches: 12,
  sparseSample: false,
  playersWithNoTogetherGames: [],
  players: [
    mate("SquadOne#DEMO", "Platinum I · 22 LP", { primaryRole: "TOP", visionScorePerMin: 0.7 }),
    mate("SquadTwo#DEMO", "Gold II · 9 LP", { primaryRole: "JUNGLE", kda: 2.1, deathShare: 26 }),
    mate("SquadThree#DEMO", "Diamond IV · 3 LP", { primaryRole: "MIDDLE", kda: 5.4 }),
    mate("SquadFour#DEMO", "Gold IV · 71 LP", { primaryRole: "BOTTOM", damageShare: 31 }),
    mate("SquadFive#DEMO", "Silver I · 40 LP", {
      primaryRole: "UTILITY",
      damageShare: 9,
      kda: 2.9,
      visionScorePerMin: 2.6,
    }),
  ],
};
