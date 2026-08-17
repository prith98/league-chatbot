"use client";

import { ReportView, RunLog } from "@/components/tools/ToolCard";
import type { ToolPart } from "@/components/tools/types";
import {
  COMPARE_FIXTURE,
  PLAYER_FIXTURE,
  TEAM_FIXTURE,
  TEAMMATES_FIXTURE,
} from "./fixtures";

const done = (type: string, output: unknown): ToolPart => ({
  type: `tool-${type}`,
  state: "output-available",
  output,
});

const running = (type: string): ToolPart => ({
  type: `tool-${type}`,
  state: "input-available",
});

const STEPS: ToolPart[] = [
  done("lookupSummoner", {
    riotId: "SampleMid#DEMO",
    summonerLevel: 412,
    region: "na1",
    ranked: [
      {
        queue: "Solo/Duo",
        rank: "Diamond II",
        leaguePoints: 41,
        wins: 128,
        losses: 106,
        winRate: "55%",
      },
      { queue: "Flex", rank: "Platinum I", leaguePoints: 12, wins: 21, losses: 19, winRate: "53%" },
    ],
  }),
  done("getMatchHistory", {
    matches: [
      {
        matchId: "1",
        champion: "Ahri",
        role: "MIDDLE",
        result: "Win",
        kda: "11/2/8",
        kdaRatio: 9.5,
        cs: 264,
        csPerMin: 8.9,
        queue: "Solo/Duo",
        durationMin: 30,
      },
      {
        matchId: "2",
        champion: "Orianna",
        role: "MIDDLE",
        result: "Loss",
        kda: "3/7/6",
        kdaRatio: 1.3,
        cs: 231,
        csPerMin: 7.4,
        queue: "Solo/Duo",
        durationMin: 31,
      },
      {
        matchId: "3",
        champion: "Azir",
        role: "MIDDLE",
        result: "Win",
        kda: "7/3/12",
        kdaRatio: 6.3,
        cs: 302,
        csPerMin: 9.6,
        queue: "Flex",
        durationMin: 31,
      },
    ],
  }),
  running("getChampionMastery"),
];

function Slice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="rule mb-3" />
      <h2 className="label mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function PreviewBoard() {
  return (
    <main className="mx-auto w-full max-w-[var(--measure)] px-4 py-10 sm:px-6">
      <p className="label">Development preview</p>
      <h1 className="display mt-2 text-[length:var(--step-display)] text-t1">Report gallery</h1>
      <p className="mt-2 max-w-[60ch] text-[length:var(--step-ui)] text-t2">
        Every card rendered from synthetic fixtures. No figure on this page comes from a real
        account.
      </p>

      <div className="mt-10">
        <Slice title="Run log — mixed states">
          <RunLog parts={STEPS} />
        </Slice>
        <Slice title="Report — loading">
          <ReportView part={running("analyzePlayerStats")} />
        </Slice>
        <Slice title="Player scouting report">
          <ReportView part={done("analyzePlayerStats", PLAYER_FIXTURE)} />
        </Slice>
        <Slice title="Head-to-head — different roles, long name">
          <ReportView part={done("comparePlayerStats", COMPARE_FIXTURE)} />
        </Slice>
        <Slice title="Team draft plan">
          <ReportView part={done("analyzeTeam", TEAM_FIXTURE)} />
        </Slice>
        <Slice title="Flex squad — five series, small multiples">
          <ReportView part={done("analyzeTeammates", TEAMMATES_FIXTURE)} />
        </Slice>
        <Slice title="Report — failed">
          <ReportView
            part={{
              type: "tool-analyzePlayerStats",
              state: "output-error",
              errorText: "Riot returned 404 for that Riot ID on na1.",
            }}
          />
        </Slice>
      </div>
    </main>
  );
}
