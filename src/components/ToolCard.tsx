"use client";

import { useState } from "react";
import { championIconUrl, useDDragonVersion } from "@/lib/ddragon";
import { StatRadar } from "@/components/StatRadar";
import { roleIndex, pctVsRoleAvg, type MetricKey } from "@/lib/roleBaselines";

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
  analyzePlayerStats: { icon: "📊", label: "Player Analysis" },
  analyzeTeam: { icon: "🛡️", label: "Team Overview" },
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
  if (key === "analyzePlayerStats") {
    const p = out.player as
      | { stats?: Record<string, { topChampions?: { champion?: string }[] }> }
      | undefined;
    const w = p?.stats?.["25"] ?? p?.stats?.["10"];
    return w?.topChampions?.[0]?.champion ?? null;
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
  if (key === "analyzePlayerStats" && out) return <PlayerStatsResult data={out} />;
  if (key === "analyzeTeam" && out) return <TeamOverviewResult data={out} />;

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
  kda?: number;
  csPerMin?: number;
}
interface RoleStat {
  role: string;
  games: number;
  pct: number;
}
interface FormStat {
  recentWinRate: number;
  priorWinRate: number;
  trend: "up" | "down" | "flat";
}
interface WindowStat {
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
  form?: FormStat;
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
  "15": "Last 15",
  "20": "Last 20",
  "25": "Last 25",
};

const QUEUE_LABELS: Record<string, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
  both: "Solo + Flex",
};

const ROLE_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
  UNKNOWN: "—",
};
const roleLabel = (r?: string) => (r ? ROLE_LABELS[r] ?? r : "—");

/** A role's share of games, e.g. "ADC 72% · Top 28%". */
function rolesSummary(roles?: RoleStat[]): string {
  if (!roles || roles.length === 0) return "—";
  return roles
    .slice(0, 2)
    .map((r) => `${roleLabel(r.role)} ${r.pct}%`)
    .join(" · ");
}

/**
 * Whether a win-rate gap exceeds sampling noise. Over a small window a 1–2 game
 * swing is meaningless; require the gap (in points) to clear ~1 standard error
 * of a coin-flip win rate over the smaller sample (50/√n) before we treat
 * either player as actually "ahead". Comparing rates (not raw win counts) keeps
 * it honest when the two players have different game counts in the window.
 */
function winRateMeaningful(a: WindowStat, b: WindowStat): boolean {
  const na = a.games ?? 0;
  const nb = b.games ?? 0;
  if (na === 0 || nb === 0) return false;
  const gap = Math.abs((a.winRate ?? 0) - (b.winRate ?? 0));
  return gap > 50 / Math.sqrt(Math.min(na, nb));
}

function ComparisonResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "20", "25"];
  const players = (data.players as ComparePlayer[]) ?? [];
  const queue = (data.queue as string) ?? "both";
  const queueLabel = QUEUE_LABELS[queue] ?? "Ranked";
  const [active, setActive] = useState(windows[windows.length - 1] ?? "25");

  if (players.length < 2) return <RawResult output={data} />;
  const [a, b] = players;
  const sa = a.stats[active] ?? { games: 0 };
  const sb = b.stats[active] ?? { games: 0 };

  // Role-dependent stats (CS/min, DPM, gold/min, damage share) are only fair to
  // crown a "winner" on when both players share a role; otherwise we show them
  // neutral so the card doesn't imply, say, a support "loses" on CS to an ADC.
  const sameRole =
    !!sa.primaryRole &&
    sa.primaryRole === sb.primaryRole &&
    sa.primaryRole !== "UNKNOWN";
  const wrMeaningful = winRateMeaningful(sa, sb);

  // Role-relative helpers: colour role-dependent rows by each player's index vs
  // their own role average (fair across roles), and annotate with the deviation.
  const idx = (s: WindowStat, k: MetricKey) => roleIndex(s.primaryRole, k, s[k]);
  const vsAvg = (s: WindowStat, k: MetricKey) => pctVsRoleAvg(s.primaryRole, k, s[k]);

  return (
    <div className="border-t border-gold-deep/30 px-3 py-3 text-xs">
      <div className="mb-2 flex justify-center">
        <span className="rounded-full border border-gold-deep/40 bg-navy/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em] text-gold/80">
          {queueLabel} ranked
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <PlayerHead player={a} align="left" />
        <span className="px-1 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-gold/60">
          vs
        </span>
        <PlayerHead player={b} align="right" />
      </div>

      {(sa.roles?.length || sb.roles?.length) ? (
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[0.6rem]">
          <span className="text-right text-arcane/90">{rolesSummary(sa.roles)}</span>
          <span className="px-1 text-center uppercase tracking-[0.12em] text-gold/50">
            {sameRole ? "same role" : "roles"}
          </span>
          <span className="text-left text-arcane/90">{rolesSummary(sb.roles)}</span>
        </div>
      ) : null}

      <WindowToggle windows={windows} active={active} onChange={setActive} />

      {sa.games === 0 && sb.games === 0 ? (
        <p className="py-2 text-center text-parch-dim">
          No {queue === "both" ? "ranked" : queueLabel} games in this window.
        </p>
      ) : (
        <div className="space-y-0.5">
          <StatRow
            label="Win Rate"
            a={sa.winRate}
            b={sb.winRate}
            format={(v) => `${Math.round(v)}%`}
            comparable={wrMeaningful}
            subA={sa.games ? `${sa.wins}W ${sa.losses}L${formGlyph(sa)}` : undefined}
            subB={sb.games ? `${sb.wins}W ${sb.losses}L${formGlyph(sb)}` : undefined}
          />
          <StatRow
            label="KDA"
            a={sa.kda}
            b={sb.kda}
            format={(v) => v.toFixed(2)}
            subA={kdaLine(sa)}
            subB={kdaLine(sb)}
          />
          <StatRow
            label="Kill Part."
            a={sa.kp}
            b={sb.kp}
            format={(v) => `${Math.round(v)}%`}
            aCompare={idx(sa, "kp")}
            bCompare={idx(sb, "kp")}
            subA={vsAvg(sa, "kp")}
            subB={vsAvg(sb, "kp")}
          />
          <StatRow
            label="Dmg Share"
            a={sa.damageShare}
            b={sb.damageShare}
            format={(v) => `${Math.round(v)}%`}
            aCompare={idx(sa, "damageShare")}
            bCompare={idx(sb, "damageShare")}
            subA={vsAvg(sa, "damageShare")}
            subB={vsAvg(sb, "damageShare")}
          />
          <StatRow
            label="Death Share"
            a={sa.deathShare}
            b={sb.deathShare}
            format={(v) => `${Math.round(v)}%`}
            aCompare={idx(sa, "deathShare")}
            bCompare={idx(sb, "deathShare")}
            subA={vsAvg(sa, "deathShare")}
            subB={vsAvg(sb, "deathShare")}
          />
          <StatRow
            label="CS / min"
            a={sa.csPerMin}
            b={sb.csPerMin}
            format={(v) => v.toFixed(1)}
            aCompare={idx(sa, "csPerMin")}
            bCompare={idx(sb, "csPerMin")}
            subA={vsAvg(sa, "csPerMin")}
            subB={vsAvg(sb, "csPerMin")}
          />
          <StatRow
            label="DPM"
            a={sa.dpm}
            b={sb.dpm}
            format={(v) => Math.round(v).toLocaleString()}
            aCompare={idx(sa, "dpm")}
            bCompare={idx(sb, "dpm")}
            subA={vsAvg(sa, "dpm")}
            subB={vsAvg(sb, "dpm")}
          />
          <StatRow
            label="Gold / min"
            a={sa.goldPerMin}
            b={sb.goldPerMin}
            format={(v) => Math.round(v).toLocaleString()}
            aCompare={idx(sa, "goldPerMin")}
            bCompare={idx(sb, "goldPerMin")}
            subA={vsAvg(sa, "goldPerMin")}
            subB={vsAvg(sb, "goldPerMin")}
          />
          <p className="pt-1 text-center text-[0.55rem] leading-snug text-parch-dim">
            Role-dependent stats compared as % vs each player&apos;s role average.
          </p>
        </div>
      )}

      {sa.games > 0 && sb.games > 0 ? (
        <div className="mt-3 border-t border-gold-deep/15 pt-3">
          <StatRadar
            series={[
              {
                label: gameName(a.riotId),
                colorClass: "text-arcane",
                role: sa.primaryRole ?? "UNKNOWN",
                metrics: radarMetrics(sa),
              },
              {
                label: gameName(b.riotId),
                colorClass: "text-gold",
                role: sb.primaryRole ?? "UNKNOWN",
                metrics: radarMetrics(sb),
              },
            ]}
          />
        </div>
      ) : null}

      {(sa.topChampions?.length || sb.topChampions?.length) ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gold-deep/15 pt-2.5">
          <ChampPool champs={sa.topChampions} version={version} align="left" />
          <ChampPool champs={sb.topChampions} version={version} align="right" />
        </div>
      ) : null}
    </div>
  );
}

/** Strip the #TAG for compact display (radar legend, single-player header). */
const gameName = (riotId: string) => riotId.split("#")[0];

/** Pull just the six radar axes out of a window's stats. */
const radarMetrics = (s: WindowStat): Record<string, number | undefined> => ({
  kda: s.kda,
  kp: s.kp,
  damageShare: s.damageShare,
  csPerMin: s.csPerMin,
  dpm: s.dpm,
  deathShare: s.deathShare,
});

/** Window selector shared by the comparison and single-player cards. */
function WindowToggle({
  windows,
  active,
  onChange,
}: {
  windows: string[];
  active: string;
  onChange: (w: string) => void;
}) {
  return (
    <div className="my-2.5 flex justify-center gap-1">
      {windows.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
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
  );
}

// ---- analyzePlayerStats (single player) ----
function PlayerStatsResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "20", "25"];
  const player = data.player as ComparePlayer | undefined;
  const queue = (data.queue as string) ?? "both";
  const queueLabel = QUEUE_LABELS[queue] ?? "Ranked";
  const [active, setActive] = useState(windows[windows.length - 1] ?? "25");

  if (!player) return <RawResult output={data} />;
  const s = player.stats[active] ?? { games: 0 };

  return (
    <div className="border-t border-gold-deep/30 px-3 py-3 text-xs">
      <div className="mb-2 flex justify-center">
        <span className="rounded-full border border-gold-deep/40 bg-navy/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em] text-gold/80">
          {queueLabel} ranked
        </span>
      </div>

      <div className="text-center">
        <div className="break-words font-medium text-cream">{player.riotId}</div>
        <div className="text-[0.65rem] text-gold/80">{player.rank}</div>
        <div className="text-[0.6rem] text-parch-dim">
          Lvl {player.summonerLevel} · {player.region} · {player.totalGames} games
        </div>
      </div>
      {s.roles?.length ? (
        <div className="mt-1 text-center text-[0.6rem] text-arcane/90">{rolesSummary(s.roles)}</div>
      ) : null}

      <WindowToggle windows={windows} active={active} onChange={setActive} />

      {s.games === 0 ? (
        <p className="py-2 text-center text-parch-dim">
          No {queue === "both" ? "ranked" : queueLabel} games in this window.
        </p>
      ) : (
        <>
          <StatRadar
            series={[
              {
                label: gameName(player.riotId),
                colorClass: "text-arcane",
                role: s.primaryRole ?? "UNKNOWN",
                metrics: radarMetrics(s),
              },
            ]}
          />
          <div className="mt-3 border-t border-gold-deep/15 pt-3">
            <StatGrid s={s} />
          </div>
          {s.topChampions?.length ? (
            <div className="mt-3 flex justify-center border-t border-gold-deep/15 pt-2.5">
              <ChampPool champs={s.topChampions} version={version} align="left" />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Compact single-player stat readout (the comparison card uses two-sided rows). */
function StatGrid({ s }: { s: WindowStat }) {
  const items: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: "Win Rate",
      value: typeof s.winRate === "number" ? `${Math.round(s.winRate)}%` : "—",
      sub: typeof s.wins === "number" ? `${s.wins}W ${s.losses}L${formGlyph(s)}` : undefined,
    },
    { label: "KDA", value: typeof s.kda === "number" ? s.kda.toFixed(2) : "—", sub: kdaLine(s) },
    {
      label: "Kill Part.",
      value: typeof s.kp === "number" ? `${s.kp}%` : "—",
      sub: pctVsRoleAvg(s.primaryRole, "kp", s.kp),
    },
    {
      label: "Dmg Share",
      value: typeof s.damageShare === "number" ? `${s.damageShare}%` : "—",
      sub: pctVsRoleAvg(s.primaryRole, "damageShare", s.damageShare),
    },
    {
      label: "CS / min",
      value: typeof s.csPerMin === "number" ? s.csPerMin.toFixed(1) : "—",
      sub: pctVsRoleAvg(s.primaryRole, "csPerMin", s.csPerMin),
    },
    {
      label: "DPM",
      value: typeof s.dpm === "number" ? Math.round(s.dpm).toLocaleString() : "—",
      sub: pctVsRoleAvg(s.primaryRole, "dpm", s.dpm),
    },
    {
      label: "Gold / min",
      value: typeof s.goldPerMin === "number" ? Math.round(s.goldPerMin).toLocaleString() : "—",
      sub: pctVsRoleAvg(s.primaryRole, "goldPerMin", s.goldPerMin),
    },
    {
      label: "Death Share",
      value: typeof s.deathShare === "number" ? `${s.deathShare}%` : "—",
      sub: pctVsRoleAvg(s.primaryRole, "deathShare", s.deathShare),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-baseline justify-between rounded bg-navy/25 px-2 py-1"
        >
          <span className="text-[0.6rem] uppercase tracking-[0.1em] text-gold/70">{it.label}</span>
          <span className="text-right leading-tight">
            <span className="font-semibold tabular-nums text-cream">{it.value}</span>
            {it.sub && <span className="ml-1 text-[0.55rem] text-parch-dim">{it.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function kdaLine(s: WindowStat): string | undefined {
  if (typeof s.kills !== "number") return undefined;
  const base = `${s.kills} / ${s.deaths} / ${s.assists}`;
  // ±stdev of per-game KDA — a consistency hint (higher = swingier).
  return typeof s.kdaStdev === "number" ? `${base} · ±${s.kdaStdev}` : base;
}

/** Recent-form arrow appended to the W/L line; empty when flat/unknown. */
function formGlyph(s: WindowStat): string {
  if (s.form?.trend === "up") return " ▲";
  if (s.form?.trend === "down") return " ▼";
  return "";
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
  comparable = true,
  aCompare,
  bCompare,
}: {
  label: string;
  a?: number;
  b?: number;
  format: (v: number) => string;
  subA?: string;
  subB?: string;
  // When false, neither side is crowned (e.g. a win-rate gap within sampling
  // noise) — values render neutral with no delta.
  comparable?: boolean;
  // When provided, colour the winner by THESE values instead of the displayed
  // ones (e.g. role-relative indices, higher = better) — keeps the raw numbers
  // on screen while comparing them fairly. Suppresses the "+delta".
  aCompare?: number;
  bCompare?: number;
}) {
  const hasA = typeof a === "number";
  const hasB = typeof b === "number";
  const cmpA = aCompare ?? a;
  const cmpB = bCompare ?? b;
  const indexed = aCompare !== undefined || bCompare !== undefined;
  const both = typeof cmpA === "number" && typeof cmpB === "number" && comparable;
  const aWins = both && cmpA > cmpB;
  const bWins = both && cmpB > cmpA;
  // Only the raw rows (no explicit compare values) show a numeric "+delta".
  const delta = both && !indexed ? Math.abs((a as number) - (b as number)) : 0;
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
          title={
            `${c.champion} · ${c.games} games · ${c.winRate}% WR` +
            (typeof c.kda === "number" ? ` · ${c.kda} KDA` : "") +
            (typeof c.csPerMin === "number" ? ` · ${c.csPerMin} CS/min` : "")
          }
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

// ---- analyzeTeam ----
interface MasteryChamp {
  champion: string;
  level: number;
  points: number;
}
interface TeamPlayer extends ComparePlayer {
  mastery?: MasteryChamp[];
  roleAffinity?: Record<string, { games: number; winRate: number }>;
}
interface AssignmentRow {
  riotId: string;
  role: string;
  gamesInRole: number;
  primaryRole: string;
}

const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const roleRank = (r: string) => {
  const i = ROLE_ORDER.indexOf(r);
  return i === -1 ? 99 : i;
};

function TeamOverviewResult({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "15"];
  const players = (data.players as TeamPlayer[]) ?? [];
  const assignment = (data.assignment as AssignmentRow[]) ?? [];
  const bans = (data.bans as string[]) ?? [];
  const enemy = (data.enemy as string[]) ?? [];
  const queue = (data.queue as string) ?? "both";
  const queueLabel = QUEUE_LABELS[queue] ?? "Ranked";
  const [active, setActive] = useState(windows[windows.length - 1] ?? "15");

  if (players.length === 0) return <RawResult output={data} />;

  const byId = new Map(players.map((p) => [p.riotId, p]));
  // Order the suggested lineup by canonical role (Top → Support).
  const lineup = [...assignment].sort((x, y) => roleRank(x.role) - roleRank(y.role));

  return (
    <div className="border-t border-gold-deep/30 px-3 py-3 text-xs">
      <div className="mb-2 flex justify-center">
        <span className="rounded-full border border-gold-deep/40 bg-navy/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em] text-gold/80">
          {queueLabel} · Team of {players.length}
        </span>
      </div>

      {bans.length || enemy.length ? (
        <div className="mb-2 space-y-1">
          {bans.length ? <DraftChips label="Bans" names={bans} tone="ban" /> : null}
          {enemy.length ? <DraftChips label="Enemy" names={enemy} tone="enemy" /> : null}
        </div>
      ) : null}

      <WindowToggle windows={windows} active={active} onChange={setActive} />

      <div className="space-y-1.5">
        {lineup.map((row) => {
          const player = byId.get(row.riotId);
          if (!player) return null;
          return (
            <TeamPlayerRow
              key={row.riotId}
              row={row}
              player={player}
              window={active}
              version={version}
            />
          );
        })}
      </div>

      <p className="pt-2 text-center text-[0.55rem] leading-snug text-parch-dim">
        Suggested lineup from each player&apos;s role history · pools show recent form &amp; all-time mastery.
      </p>
    </div>
  );
}

/** Compact role tag for the lineup. */
function RolePill({ role }: { role: string }) {
  return (
    <span className="w-14 shrink-0 rounded border border-arcane/40 bg-arcane/10 py-0.5 text-center text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-arcane">
      {roleLabel(role)}
    </span>
  );
}

/** How well an assigned role matches a player's history: their main, a role
 *  they at least play, or an off-role fill. */
function FitBadge({
  role,
  primaryRole,
  gamesInRole,
}: {
  role: string;
  primaryRole: string;
  gamesInRole: number;
}) {
  // No role data at all (e.g. unranked / no games this queue) — don't imply a
  // judgement; the optimizer just slotted them into the leftover role.
  const fit =
    primaryRole === "UNKNOWN"
      ? "nodata"
      : role === primaryRole
        ? "main"
        : gamesInRole > 0
          ? "flex"
          : "off";
  const style =
    fit === "main"
      ? "border-win/40 bg-win/10 text-win"
      : fit === "flex"
        ? "border-gold-deep/40 bg-gold/10 text-gold"
        : fit === "off"
          ? "border-loss/40 bg-loss/10 text-loss/90"
          : "border-gold-deep/30 bg-navy/60 text-parch-dim";
  const label =
    fit === "main" ? "Main" : fit === "flex" ? "Flex" : fit === "off" ? "Off-role" : "No data";
  return (
    <span
      className={"shrink-0 rounded border px-1 py-0 text-[0.5rem] uppercase tracking-wider " + style}
    >
      {label}
    </span>
  );
}

function TeamPlayerRow({
  row,
  player,
  window: w,
  version,
}: {
  row: AssignmentRow;
  player: TeamPlayer;
  window: string;
  version: string;
}) {
  const s = player.stats[w] ?? { games: 0 };
  const wr = s.winRate;
  return (
    <div className="rounded-md border border-gold-deep/25 bg-navy/40 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <RolePill role={row.role} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-medium text-cream">{gameName(player.riotId)}</span>
            <FitBadge role={row.role} primaryRole={row.primaryRole} gamesInRole={row.gamesInRole} />
          </div>
          <div className="text-[0.6rem] text-gold/80">
            {player.rank}
            {s.roles?.length ? (
              <span className="text-arcane/70"> · {rolesSummary(s.roles)}</span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right leading-tight">
          {typeof wr === "number" ? (
            <div
              className={"font-semibold tabular-nums " + (wr >= 50 ? "text-win" : "text-loss/90")}
            >
              {wr}%
            </div>
          ) : (
            <div className="text-parch-dim">—</div>
          )}
          {typeof s.kda === "number" ? (
            <div className="text-[0.55rem] text-parch-dim">{s.kda.toFixed(2)} KDA</div>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 space-y-1">
        <PoolRow label="Recent" version={version} recency={s.topChampions} />
        <PoolRow label="Mastery" version={version} mastery={player.mastery} />
      </div>
    </div>
  );
}

/** One pool line — recency champions (with WR) or mastery champions (with M-level). */
function PoolRow({
  label,
  version,
  recency,
  mastery,
}: {
  label: string;
  version: string;
  recency?: ChampStat[];
  mastery?: MasteryChamp[];
}) {
  if (!recency?.length && !mastery?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-12 shrink-0 text-[0.5rem] uppercase tracking-[0.1em] text-parch-dim">
        {label}
      </span>
      {recency?.map((c) => (
        <span
          key={c.champion}
          title={`${c.champion} · ${c.games}g · ${c.winRate}% WR`}
          className="flex items-center gap-0.5 rounded border border-gold-deep/30 bg-navy/60 px-1 py-0.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(c.champion, version)}
            alt={c.champion}
            width={14}
            height={14}
            className="rounded ring-1 ring-gold-deep/40"
          />
          <span className="text-[0.5rem] text-parch-dim">{c.winRate}%</span>
        </span>
      ))}
      {mastery?.map((m) => (
        <span
          key={m.champion}
          title={`${m.champion} · M${m.level} · ${Math.round(m.points / 1000)}k pts`}
          className="flex items-center gap-0.5 rounded border border-gold-deep/30 bg-navy/60 px-1 py-0.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(m.champion, version)}
            alt={m.champion}
            width={14}
            height={14}
            className="rounded ring-1 ring-gold-deep/40"
          />
          <span className="text-[0.5rem] font-semibold text-gold">M{m.level}</span>
        </span>
      ))}
    </div>
  );
}

/** Banned (struck-through) or enemy champion name chips. Names are user-typed,
 *  so we show them as text rather than risk a mismatched icon URL. */
function DraftChips({
  label,
  names,
  tone,
}: {
  label: string;
  names: string[];
  tone: "ban" | "enemy";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-12 shrink-0 text-[0.5rem] uppercase tracking-[0.1em] text-parch-dim">
        {label}
      </span>
      {names.map((n) => (
        <span
          key={n}
          className={
            "rounded border px-1.5 py-0.5 text-[0.55rem] " +
            (tone === "ban"
              ? "border-loss/40 bg-loss/10 text-loss/80 line-through"
              : "border-gold-deep/40 bg-navy/60 text-parch")
          }
        >
          {n}
        </span>
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
