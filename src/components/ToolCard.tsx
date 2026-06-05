"use client";

import { useState } from "react";
import { championIconUrl, useDDragonVersion } from "@/lib/ddragon";

type ToolState =
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

const TOOL_META: Record<string, { icon: string; label: string }> = {
  lookupSummoner: { icon: "🔎", label: "Summoner Lookup" },
  getMatchHistory: { icon: "📜", label: "Match History" },
  getChampionMastery: { icon: "⭐", label: "Champion Mastery" },
  comparePlayerStats: { icon: "⚔️", label: "Player Comparison" },
};

function toolKey(part: ToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "opgg";
  return part.type.slice(5); // strip "tool-"
}

function meta(part: ToolPart) {
  const key = toolKey(part);
  if (part.type === "dynamic-tool") {
    return { icon: "🌐", label: `OP.GG · ${key.replace(/^lol_/, "").replace(/_/g, " ")}` };
  }
  return TOOL_META[key] ?? { icon: "⚙️", label: key };
}

// Ranked tier → accent colour (LoL client crest palette).
const TIER_STYLE: Record<string, string> = {
  IRON: "#7a6b63",
  BRONZE: "#b06b3f",
  SILVER: "#9fb1bd",
  GOLD: "#f0b65c",
  PLATINUM: "#4fd0c5",
  EMERALD: "#36d97c",
  DIAMOND: "#6fa8ff",
  MASTER: "#c25ce0",
  GRANDMASTER: "#ff5a52",
  CHALLENGER: "#6fe0f2",
};

/** The champion to feature as a faded splash backdrop, if any. */
function featureChampion(part: ToolPart): string | null {
  const key = toolKey(part);
  const out = part.output as Record<string, unknown> | undefined;
  if (!out) return null;
  if (key === "getMatchHistory") {
    return (out.matches as { champion?: string }[] | undefined)?.[0]?.champion ?? null;
  }
  if (key === "getChampionMastery") {
    return (out.top as { champion?: string }[] | undefined)?.[0]?.champion ?? null;
  }
  return null;
}

function splashUrl(champion: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_0.jpg`;
}

/** Faded champion splash that bleeds in from the right of a tool card. */
function ChampSplash({ champion }: { champion: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={splashUrl(champion)}
        alt=""
        onError={() => setOk(false)}
        className="absolute right-0 top-0 h-full w-3/4 object-cover object-[center_20%] opacity-[0.22]"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 62%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 62%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss/85 via-abyss/10 to-abyss/40" />
    </div>
  );
}

/** Small faceted hextech crystal tinted to a ranked tier. */
function TierGem({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center">
      <span className="absolute inset-1 rounded-full opacity-40 blur-[5px]" style={{ background: color }} />
      <svg width="22" height="22" viewBox="0 0 24 24" className="relative">
        <polygon
          points="12,1.5 21,6.75 21,17.25 12,22.5 3,17.25 3,6.75"
          fill={color}
          fillOpacity="0.22"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points="12,5.5 17.5,8.6 17.5,15.4 12,18.5 6.5,15.4 6.5,8.6"
          fill="none"
          stroke={color}
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2" fill={color} />
      </svg>
    </span>
  );
}

/** Hextech console for a single tool call: a scanning state, then structured intel. */
export function ToolCard({ part }: { part: ToolPart }) {
  const { icon, label } = meta(part);
  const done = part.state === "output-available";
  const errored = part.state === "output-error";
  const running = !done && !errored;
  const champ = done ? featureChampion(part) : null;

  return (
    <div className="relative my-2.5 overflow-hidden rounded-md border border-gold-deep/40 bg-abyss/70">
      {champ && <ChampSplash champion={champ} />}

      {/* top hairline accent */}
      <div className="relative z-10 h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      {running && <div className="scan-bar z-10" />}

      <div className="relative z-10 flex items-center gap-2 px-3 py-2 text-xs">
        <span className="text-sm">{icon}</span>
        <span className="font-semibold uppercase tracking-[0.12em] text-gold/90">
          {label}
        </span>
        {running && (
          <span className="ml-auto flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-arcane">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arcane" />
            Analyzing
          </span>
        )}
        {done && <span className="ml-auto text-sm text-win">✓</span>}
        {errored && (
          <span className="ml-auto text-[0.65rem] uppercase tracking-wider text-loss">
            Failed
          </span>
        )}
      </div>

      {done && (
        <div className="relative z-10">
          <ToolResult part={part} />
        </div>
      )}
      {errored && (
        <div className="relative z-10 border-t border-gold-deep/30 px-3 py-2 text-xs text-loss/90">
          {part.errorText}
        </div>
      )}
    </div>
  );
}

function ToolResult({ part }: { part: ToolPart }) {
  const key = toolKey(part);
  const out = part.output as Record<string, unknown> | undefined;

  if (key === "lookupSummoner" && out) return <SummonerResult data={out} />;
  if (key === "getMatchHistory" && out) return <MatchHistoryResult data={out} />;
  if (key === "getChampionMastery" && out) return <MasteryResult data={out} />;
  if (key === "comparePlayerStats" && out) return <ComparisonResult data={out} />;

  // Generic collapsible for OP.GG / unknown tools.
  return <RawResult output={part.output} />;
}

// ---- lookupSummoner ----
interface RankedRow {
  queue: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: string;
}
function SummonerResult({ data }: { data: Record<string, unknown> }) {
  const ranked = data.ranked;
  return (
    <div className="border-t border-gold-deep/30 px-3 py-2.5 text-xs">
      <div className="mb-1.5 font-medium text-cream">
        {String(data.riotId)}{" "}
        <span className="text-parch-dim">
          · Lvl {String(data.summonerLevel)} · {String(data.region)}
        </span>
      </div>
      {Array.isArray(ranked) ? (
        <div className="space-y-1.5">
          {(ranked as RankedRow[]).map((r) => {
            const [tierRaw = "", division = ""] = r.rank.split(" ");
            const color = TIER_STYLE[tierRaw.toUpperCase()] ?? "#c8aa6e";
            const tierLabel = tierRaw
              ? tierRaw[0] + tierRaw.slice(1).toLowerCase()
              : r.rank;
            const wr = parseInt(r.winRate, 10);
            return (
              <div
                key={r.queue}
                className="flex items-center gap-2.5 rounded-md border border-gold-deep/25 bg-navy/50 px-2.5 py-1.5"
              >
                <TierGem color={color} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold" style={{ color }}>
                      {tierLabel}
                    </span>
                    {division && <span className="text-cream">{division}</span>}
                    <span className="text-[0.7rem] text-parch-dim">{r.leaguePoints} LP</span>
                  </div>
                  <div className="text-[0.62rem] uppercase tracking-[0.12em] text-parch-dim">
                    {r.queue}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-parch">
                    {r.wins}W {r.losses}L
                  </div>
                  <div
                    className={
                      "text-[0.7rem] font-medium " +
                      (Number.isFinite(wr)
                        ? wr >= 50
                          ? "text-win"
                          : "text-loss/90"
                        : "text-parch-dim")
                    }
                  >
                    {r.winRate} WR
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-parch-dim">Unranked</span>
      )}
    </div>
  );
}

// ---- getMatchHistory ----
interface MatchRow {
  matchId: string;
  champion: string;
  role: string;
  result: string;
  kda: string;
  kdaRatio: number;
  cs: number;
  csPerMin: number;
  queue: string;
  durationMin: number;
}
function MatchHistoryResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const matches = (data.matches as MatchRow[]) ?? [];
  return (
    <div className="border-t border-gold-deep/30 px-2 py-1.5">
      <table className="w-full text-xs">
        <tbody>
          {matches.map((m) => {
            const win = m.result === "Win";
            return (
              <tr
                key={m.matchId}
                className="border-t border-gold-deep/15 first:border-t-0"
              >
                <td className="py-1.5 pl-1 pr-2">
                  <span
                    className={
                      "inline-block h-7 w-1 rounded-full " +
                      (win ? "bg-win" : "bg-loss")
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={championIconUrl(m.champion, version)}
                    alt={m.champion}
                    width={24}
                    height={24}
                    className="rounded ring-1 ring-gold-deep/40"
                  />
                </td>
                <td className="pr-2 text-cream">{m.champion}</td>
                <td className="pr-3">
                  <span className={win ? "font-semibold text-win" : "font-semibold text-loss"}>
                    {win ? "Victory" : "Defeat"}
                  </span>
                </td>
                <td className="pr-3 text-parch">{m.kda}</td>
                <td className="pr-2 text-parch-dim">{m.csPerMin}/min</td>
                <td className="text-right text-parch-dim">{m.queue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- getChampionMastery ----
interface MasteryRow {
  champion: string;
  level: number;
  points: number;
}
function MasteryResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const top = (data.top as MasteryRow[]) ?? [];
  return (
    <div className="flex flex-wrap gap-2 border-t border-gold-deep/30 px-3 py-2.5">
      {top.map((m) => (
        <div
          key={m.champion}
          className="flex items-center gap-1.5 rounded border border-gold-deep/30 bg-navy/60 px-2 py-1 text-xs"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(m.champion, version)}
            alt={m.champion}
            width={20}
            height={20}
            className="rounded ring-1 ring-gold-deep/40"
          />
          <span className="text-cream">{m.champion}</span>
          <span className="font-semibold text-gold">M{m.level}</span>
          <span className="text-parch-dim">{Math.round(m.points / 1000)}k</span>
        </div>
      ))}
    </div>
  );
}

// ---- comparePlayerStats ----
interface ChampStat {
  champion: string;
  games: number;
  winRate: number;
}
interface WindowStat {
  games: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  kda?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  dpm?: number;
  goldPerMin?: number;
  topChampions?: ChampStat[];
}
interface ComparePlayer {
  riotId: string;
  region: string;
  summonerLevel: number;
  rank: string;
  totalGames: number;
  stats: Record<string, WindowStat>;
}

const WINDOW_LABELS: Record<string, string> = {
  "10": "Last 10",
  "20": "Last 20",
  "25": "Last 25",
};

function ComparisonResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "20", "25"];
  const players = (data.players as ComparePlayer[]) ?? [];
  const [active, setActive] = useState(windows[windows.length - 1] ?? "25");

  if (players.length < 2) return <RawResult output={data} />;
  const [a, b] = players;
  const sa = a.stats[active] ?? { games: 0 };
  const sb = b.stats[active] ?? { games: 0 };

  return (
    <div className="border-t border-gold-deep/30 px-3 py-3 text-xs">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <PlayerHead player={a} align="left" />
        <span className="px-1 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-gold/60">
          vs
        </span>
        <PlayerHead player={b} align="right" />
      </div>

      <div className="my-2.5 flex justify-center gap-1">
        {windows.map((w) => (
          <button
            key={w}
            onClick={() => setActive(w)}
            className={
              "rounded border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider transition-colors " +
              (active === w
                ? "border-arcane/60 bg-arcane/10 text-arcane"
                : "border-gold-deep/30 text-parch hover:text-gold")
            }
          >
            {WINDOW_LABELS[w] ?? w}
          </button>
        ))}
      </div>

      {sa.games === 0 && sb.games === 0 ? (
        <p className="py-2 text-center text-parch-dim">No ranked games in this window.</p>
      ) : (
        <div className="space-y-0.5">
          <StatRow
            label="Win Rate"
            a={sa.winRate}
            b={sb.winRate}
            format={(v) => `${Math.round(v)}%`}
            subA={sa.games ? `${sa.wins}W ${sa.losses}L` : undefined}
            subB={sb.games ? `${sb.wins}W ${sb.losses}L` : undefined}
          />
          <StatRow
            label="KDA"
            a={sa.kda}
            b={sb.kda}
            format={(v) => v.toFixed(2)}
            subA={kdaLine(sa)}
            subB={kdaLine(sb)}
          />
          <StatRow label="CS / min" a={sa.csPerMin} b={sb.csPerMin} format={(v) => v.toFixed(1)} />
          <StatRow label="DPM" a={sa.dpm} b={sb.dpm} format={(v) => Math.round(v).toLocaleString()} />
          <StatRow
            label="Gold / min"
            a={sa.goldPerMin}
            b={sb.goldPerMin}
            format={(v) => Math.round(v).toLocaleString()}
          />
        </div>
      )}

      {(sa.topChampions?.length || sb.topChampions?.length) ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gold-deep/15 pt-2.5">
          <ChampPool champs={sa.topChampions} version={version} align="left" />
          <ChampPool champs={sb.topChampions} version={version} align="right" />
        </div>
      ) : null}
    </div>
  );
}

function kdaLine(s: WindowStat): string | undefined {
  if (typeof s.kills !== "number") return undefined;
  return `${s.kills} / ${s.deaths} / ${s.assists}`;
}

function PlayerHead({ player, align }: { player: ComparePlayer; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="break-words font-medium text-cream">{player.riotId}</div>
      <div className="text-[0.65rem] text-gold/80">{player.rank}</div>
      <div className="text-[0.6rem] text-parch-dim">
        Lvl {player.summonerLevel} · {player.region} · {player.totalGames} games
      </div>
    </div>
  );
}

function StatRow({
  label,
  a,
  b,
  format,
  subA,
  subB,
}: {
  label: string;
  a?: number;
  b?: number;
  format: (v: number) => string;
  subA?: string;
  subB?: string;
}) {
  const hasA = typeof a === "number";
  const hasB = typeof b === "number";
  const aWins = hasA && hasB && (a as number) > (b as number);
  const bWins = hasA && hasB && (b as number) > (a as number);
  const delta = hasA && hasB ? Math.abs((a as number) - (b as number)) : 0;
  const deltaStr = delta > 0 ? `+${format(delta)}` : "";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded px-1.5 py-1 odd:bg-navy/25">
      <div className="text-right leading-tight">
        <div>
          {aWins && deltaStr && <span className="mr-1 text-[0.6rem] text-win/70">{deltaStr}</span>}
          <span className={"font-semibold tabular-nums " + (aWins ? "text-win" : "text-cream")}>
            {hasA ? format(a as number) : "—"}
          </span>
        </div>
        {subA && <div className="text-[0.6rem] text-parch-dim">{subA}</div>}
      </div>
      <div className="px-1 text-center text-[0.6rem] uppercase tracking-[0.12em] text-gold/70">
        {label}
      </div>
      <div className="text-left leading-tight">
        <div>
          <span className={"font-semibold tabular-nums " + (bWins ? "text-win" : "text-cream")}>
            {hasB ? format(b as number) : "—"}
          </span>
          {bWins && deltaStr && <span className="ml-1 text-[0.6rem] text-win/70">{deltaStr}</span>}
        </div>
        {subB && <div className="text-[0.6rem] text-parch-dim">{subB}</div>}
      </div>
    </div>
  );
}

function ChampPool({
  champs,
  version,
  align,
}: {
  champs?: ChampStat[];
  version: string;
  align: "left" | "right";
}) {
  if (!champs || champs.length === 0) return <div />;
  return (
    <div className={"flex flex-wrap gap-1.5 " + (align === "right" ? "justify-end" : "justify-start")}>
      {champs.map((c) => (
        <div
          key={c.champion}
          className="flex items-center gap-1 rounded border border-gold-deep/30 bg-navy/60 px-1.5 py-0.5"
          title={`${c.champion} · ${c.games} games · ${c.winRate}% WR`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(c.champion, version)}
            alt={c.champion}
            width={16}
            height={16}
            className="rounded ring-1 ring-gold-deep/40"
          />
          <span className="text-[0.65rem] text-cream">{c.games}g</span>
          <span className="text-[0.6rem] text-parch-dim">{c.winRate}%</span>
        </div>
      ))}
    </div>
  );
}

// ---- generic ----
function RawResult({ output }: { output: unknown }) {
  const [open, setOpen] = useState(false);
  if (output == null) return null;
  const text = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  const preview = text.length > 160 ? text.slice(0, 160) + "…" : text;
  return (
    <div className="border-t border-gold-deep/30 px-3 py-2 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-parch transition-colors hover:text-gold"
      >
        {open ? "▾ hide data" : "▸ show data"}
      </button>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] text-parch">
        {open ? text : preview}
      </pre>
    </div>
  );
}
