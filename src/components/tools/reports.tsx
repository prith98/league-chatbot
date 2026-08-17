"use client";

import { useState } from "react";
import { useDDragonVersion } from "@/lib/ddragon";
import { pctVsRoleAvg, roleIndex, type MetricKey } from "@/lib/roleBaselines";
import { seriesColor } from "@/lib/viz";
import { BaselineKey, Delta, Meter, Stat, StatTile } from "@/components/viz/Meter";
import {
  RADAR_AXES,
  StatRadar,
  VISION_AXIS,
  type RadarSeries,
} from "@/components/viz/StatRadar";
import { SegmentedControl, type SegmentOption } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";
import { ChampChip, ChampIcon, ReportCard, ScopeTag } from "@/components/tools/ToolCard";
import {
  type AssignmentRow,
  type ChampStat,
  OUTCOME_KEYS,
  type OutcomeKey,
  type PlayerPayload,
  QUEUE_LABELS,
  type TeamPlayer,
  type TeammatePlayer,
  type WindowStat,
  gameName,
  roleCounts,
  roleLabel,
  roleRank,
  rolesSummary,
  winRateMeaningful,
} from "@/components/tools/types";

/* ============================================================================
   Reports

   Shared rules across all four:
     · No figure is shown without its baseline. Every role-dependent stat gets a
       meter; win rate gets one centred on 50%, which is the only reference a
       win rate has.
     · Nobody is crowned. The old card painted the higher number green, which
       told a support they "lost" on CS to an ADC. Each player is measured
       against their own role instead, and both bars share one centre.
     · Filters are one row, above everything they scope.
   ========================================================================= */

/* --------------------------------------------------------------- helpers -- */

const idx = (s: WindowStat, k: MetricKey) => roleIndex(s.primaryRole, k, s[k]);
const num = (v: number | undefined, f: (n: number) => string) =>
  typeof v === "number" ? f(v) : "—";

const radarMetrics = (s: WindowStat): Record<string, number | undefined> => ({
  kda: s.kda,
  kp: s.kp,
  damageShare: s.damageShare,
  csPerMin: s.csPerMin,
  dpm: s.dpm,
  deathShare: s.deathShare,
});

/** Win rate has no role baseline — its reference is the coin flip. */
const wrIndex = (wr: number | undefined) => (typeof wr === "number" ? wr / 50 : undefined);
const wrDelta = (wr: number | undefined) => {
  if (typeof wr !== "number") return undefined;
  const pts = Math.round(wr - 50);
  return `${pts >= 0 ? "+" : ""}${pts} pts`;
};

/**
 * Deaths are the one metric where "more" is worse, so the raw deviation and the
 * goodness index point opposite ways. We show the RAW change (25% fewer deaths)
 * with a downward arrow, and let the colour and the meter carry the verdict.
 */
function deathsDelta(s: WindowStat): { label?: string; glyphDown?: boolean } {
  const raw = pctVsRoleAvg(s.primaryRole, "deathShare", s.deathShare);
  if (!raw) return {};
  const pct = parseInt(raw, 10);
  return { label: `${Math.abs(pct)}%`, glyphDown: pct <= 0 };
}

function kdaLine(s: WindowStat): string | undefined {
  if (typeof s.kills !== "number") return undefined;
  const base = `${s.kills} / ${s.deaths} / ${s.assists} per game`;
  return typeof s.kdaStdev === "number" ? `${base} · ±${s.kdaStdev} spread` : base;
}

function formNote(s: WindowStat): string | undefined {
  if (typeof s.wins !== "number") return undefined;
  const wl = `${s.wins}W ${s.losses}L`;
  if (s.form?.trend === "up") return `${wl} · trending up`;
  if (s.form?.trend === "down") return `${wl} · trending down`;
  return wl;
}

/** The stat list shared by the single-player report. */
const STAT_ROWS: Array<{
  key: MetricKey;
  label: string;
  fmt: (v: number) => string;
  note?: string;
}> = [
  { key: "kda", label: "KDA", fmt: (v) => v.toFixed(2) },
  { key: "kp", label: "Kill participation", fmt: (v) => `${Math.round(v)}%` },
  { key: "damageShare", label: "Damage share", fmt: (v) => `${Math.round(v)}%` },
  { key: "csPerMin", label: "CS per minute", fmt: (v) => v.toFixed(1) },
  { key: "dpm", label: "Damage per minute", fmt: (v) => Math.round(v).toLocaleString() },
  { key: "goldPerMin", label: "Gold per minute", fmt: (v) => Math.round(v).toLocaleString() },
  {
    key: "deathShare",
    label: "Deaths",
    fmt: (v) => `${Math.round(v)}%`,
    note: "share of the team's deaths — fewer is better, so the bar grows right",
  },
];

function windowOptions(windows: readonly string[]): SegmentOption<string>[] {
  return windows.map((w) => ({ value: w, label: w }));
}

function roleOptions(player: PlayerPayload): SegmentOption<string>[] {
  const counts = roleCounts(player);
  return [
    { value: "ALL", label: "All", count: counts.ALL },
    ...(player.availableRoles ?? []).map((r) => ({
      value: r,
      label: roleLabel(r),
      count: counts[r],
    })),
  ];
}

function resolve(player: PlayerPayload, role: string, window: string): WindowStat {
  return (role === "ALL" ? player.stats[window] : player.byRole?.[role]?.[window]) ?? { games: 0 };
}

/** Name, rank, region — the identity block above every report. */
function Identity({
  player,
  swatch,
  roles,
  portrait,
  version,
}: {
  player: { riotId: string; rank: string; region: string; summonerLevel: number; totalGames: number };
  swatch?: string;
  roles?: string;
  portrait?: string;
  version?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {portrait && version && (
        <ChampIcon champion={portrait} version={version} size={40} />
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          {swatch && (
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: swatch }}
            />
          )}
          <span className="truncate text-[length:var(--step-lead)] font-medium text-t1">
            {player.riotId}
          </span>
        </p>
        <p className="mono mt-0.5 truncate text-[length:var(--step-ui)] text-t2">{player.rank}</p>
        <p className="mono mt-0.5 truncate text-[length:var(--step-label)] text-t3">
          {player.region.toUpperCase()} · Lvl {player.summonerLevel} · {player.totalGames} ranked
          games
        </p>
        {roles && roles !== "—" && (
          <p className="mono mt-0.5 truncate text-[length:var(--step-label)] text-t2">{roles}</p>
        )}
      </div>
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge px-3.5 py-3 sm:px-4">
      {children}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="label shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-[length:var(--step-ui)] text-t2">{children}</p>;
}

function Section({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-edge px-3.5 py-3.5 sm:px-4 ${className}`}>
      {title && <h4 className="label mb-2.5">{title}</h4>}
      {children}
    </div>
  );
}

/* =========================================================== 1. one player = */

export function PlayerReport({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "25", "50"];
  const player = data.player as PlayerPayload | undefined;
  const queue = (data.queue as string) ?? "both";
  const [window, setWindow] = useState(windows[windows.length - 1] ?? "50");
  const [role, setRole] = useState("ALL");

  if (!player) return null;
  const s = resolve(player, role, window);
  const top = player.stats[window]?.topChampions?.[0]?.champion;

  return (
    <ReportCard
      icon={<Icon name="radar" size={15} />}
      label="Player scouting report"
      meta={<ScopeTag>{QUEUE_LABELS[queue] ?? "Ranked"}</ScopeTag>}
    >
      <div className="px-3.5 py-3.5 sm:px-4">
        <Identity
          player={player}
          roles={rolesSummary(player.stats[window]?.roles)}
          portrait={top}
          version={version}
        />
      </div>

      <FilterBar>
        <FilterGroup label="Last">
          <SegmentedControl
            label="Sample size in games"
            options={windowOptions(windows)}
            value={window}
            onChange={setWindow}
            size="sm"
          />
        </FilterGroup>
        {(player.availableRoles?.length ?? 0) > 0 && (
          <FilterGroup label="Role">
            <SegmentedControl
              label="Filter by role"
              options={roleOptions(player)}
              value={role}
              onChange={setRole}
              size="sm"
            />
          </FilterGroup>
        )}
      </FilterBar>

      {s.games === 0 ? (
        <Empty>
          No {QUEUE_LABELS[queue]?.toLowerCase() ?? "ranked"} games in this window
          {role !== "ALL" ? ` as ${roleLabel(role)}` : ""}. Try a wider sample.
        </Empty>
      ) : (
        <>
          <div className="grid gap-x-6 border-t border-edge px-3.5 py-3.5 sm:px-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="mb-5 md:mb-0">
              <StatRadar
                series={[
                  {
                    label: gameName(player.riotId),
                    color: seriesColor(0),
                    role: s.primaryRole ?? "UNKNOWN",
                    metrics: radarMetrics(s),
                  },
                ]}
              />
              <div className="mt-4 rounded-lg bg-s2/60 p-3">
                <BaselineKey />
                <p className="mt-1.5 text-[length:var(--step-label)] leading-relaxed text-t3">
                  Win rate is the exception — its tick is a 50% coin flip.
                </p>
              </div>
            </div>

            <div className="min-w-0 divide-y divide-edge">
              <Stat
                label="Win rate"
                value={num(s.winRate, (v) => `${Math.round(v)}%`)}
                index={wrIndex(s.winRate)}
                deltaLabel={wrDelta(s.winRate)}
                note={formNote(s)}
              />
              {STAT_ROWS.map((r) => (
                <Stat
                  key={r.key}
                  label={r.label}
                  value={num(s[r.key], r.fmt)}
                  index={typeof s[r.key] === "number" ? idx(s, r.key) : undefined}
                  note={r.key === "kda" ? kdaLine(s) : r.note}
                  {...(r.key === "deathShare"
                    ? { deltaLabel: deathsDelta(s).label, deltaGlyphDown: deathsDelta(s).glyphDown }
                    : {})}
                />
              ))}
            </div>
          </div>

          {s.topChampions?.length ? (
            <Section title={`Champion pool · last ${window}`}>
              <div className="flex flex-wrap gap-1.5">
                {s.topChampions.map((c) => (
                  <ChampChip key={c.champion} c={c} version={version} />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}
    </ReportCard>
  );
}

/* ======================================================== 2. head-to-head = */

/** One metric, both players, one shared centre line. */
function VersusStat({
  label,
  rows,
}: {
  label: string;
  rows: Array<{
    name: string;
    color: string;
    value: string;
    index?: number;
    deltaLabel?: string;
    glyphDown?: boolean;
  }>;
}) {
  return (
    <div className="py-2">
      <p className="label mb-1.5">{label}</p>
      <div className="space-y-2 sm:space-y-1.5">
        {rows.map((r) => (
          /* One grid, two shapes. Narrow screens put the meter on its own
             full-width row rather than squeezing it into 40px, where a ±20%
             displacement would be four pixels long and read as nothing. Every
             cell is placed explicitly so the reflow cannot drift. */
          <div
            key={r.name}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[auto_5rem_3.5rem_minmax(4rem,1fr)_4rem] sm:gap-y-0"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px] sm:col-start-1"
              style={{ background: r.color }}
            />
            <span className="truncate text-[length:var(--step-label)] text-t2 sm:col-start-2">
              {r.name}
            </span>
            <span className="mono w-14 text-right text-[length:var(--step-ui)] font-medium text-t1 sm:col-start-3 sm:w-auto">
              {r.value}
            </span>
            <span className="mono w-16 text-right text-[length:var(--step-label)] sm:col-start-5">
              {typeof r.index === "number" ? (
                <Delta index={r.index} label={r.deltaLabel} glyphDown={r.glyphDown} />
              ) : (
                <span className="text-t3">—</span>
              )}
            </span>
            <Meter
              index={r.index}
              color={r.color}
              className="col-span-4 sm:col-span-1 sm:col-start-4 sm:row-start-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparisonReport({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "25", "50"];
  const players = (data.players as PlayerPayload[]) ?? [];
  const queue = (data.queue as string) ?? "both";
  const [window, setWindow] = useState(windows[windows.length - 1] ?? "50");
  const [roleA, setRoleA] = useState("ALL");
  const [roleB, setRoleB] = useState("ALL");

  if (players.length < 2) return null;
  const [a, b] = players;
  const sa = resolve(a, roleA, window);
  const sb = resolve(b, roleB, window);
  const colorA = seriesColor(0);
  const colorB = seriesColor(1);

  const sameRole =
    !!sa.primaryRole && sa.primaryRole === sb.primaryRole && sa.primaryRole !== "UNKNOWN";
  const wrMeaningful = winRateMeaningful(sa, sb);
  const both = sa.games > 0 && sb.games > 0;

  const rowsFor = (k: MetricKey, fmt: (v: number) => string) => [
    {
      name: gameName(a.riotId),
      color: colorA,
      value: num(sa[k], fmt),
      index: typeof sa[k] === "number" ? idx(sa, k) : undefined,
    },
    {
      name: gameName(b.riotId),
      color: colorB,
      value: num(sb[k], fmt),
      index: typeof sb[k] === "number" ? idx(sb, k) : undefined,
    },
  ];

  return (
    <ReportCard
      icon={<Icon name="versus" size={15} />}
      label="Head-to-head"
      meta={<ScopeTag>{QUEUE_LABELS[queue] ?? "Ranked"}</ScopeTag>}
    >
      <div className="grid gap-4 px-3.5 py-3.5 sm:grid-cols-2 sm:px-4">
        <div>
          <Identity player={a} swatch={colorA} roles={rolesSummary(a.stats[window]?.roles)} />
          {(a.availableRoles?.length ?? 0) > 0 && (
            <SegmentedControl
              className="mt-2.5"
              label={`Filter ${gameName(a.riotId)} by role`}
              options={roleOptions(a)}
              value={roleA}
              onChange={setRoleA}
              size="sm"
            />
          )}
        </div>
        <div>
          <Identity player={b} swatch={colorB} roles={rolesSummary(b.stats[window]?.roles)} />
          {(b.availableRoles?.length ?? 0) > 0 && (
            <SegmentedControl
              className="mt-2.5"
              label={`Filter ${gameName(b.riotId)} by role`}
              options={roleOptions(b)}
              value={roleB}
              onChange={setRoleB}
              size="sm"
            />
          )}
        </div>
      </div>

      <FilterBar>
        <FilterGroup label="Last">
          <SegmentedControl
            label="Sample size in games"
            options={windowOptions(windows)}
            value={window}
            onChange={setWindow}
            size="sm"
          />
        </FilterGroup>
        <p className="mono text-[length:var(--step-label)] text-t3">
          {sameRole
            ? `Both playing ${roleLabel(sa.primaryRole)} — raw figures compare directly.`
            : "Different roles — compare the bars, not the raw figures."}
        </p>
      </FilterBar>

      {!both ? (
        <Empty>
          One of these players has no {QUEUE_LABELS[queue]?.toLowerCase() ?? "ranked"} games in this
          window. Try a wider sample.
        </Empty>
      ) : (
        <>
          <Section>
            <StatRadar
              series={[
                {
                  label: gameName(a.riotId),
                  color: colorA,
                  role: sa.primaryRole ?? "UNKNOWN",
                  metrics: radarMetrics(sa),
                },
                {
                  label: gameName(b.riotId),
                  color: colorB,
                  role: sb.primaryRole ?? "UNKNOWN",
                  metrics: radarMetrics(sb),
                },
              ]}
            />
          </Section>

          <Section>
            <div className="divide-y divide-edge">
              <VersusStat
                label="Win rate"
                rows={[
                  {
                    name: gameName(a.riotId),
                    color: colorA,
                    value: num(sa.winRate, (v) => `${Math.round(v)}%`),
                    index: wrIndex(sa.winRate),
                    deltaLabel: wrDelta(sa.winRate),
                  },
                  {
                    name: gameName(b.riotId),
                    color: colorB,
                    value: num(sb.winRate, (v) => `${Math.round(v)}%`),
                    index: wrIndex(sb.winRate),
                    deltaLabel: wrDelta(sb.winRate),
                  },
                ]}
              />
              {!wrMeaningful && (
                <p className="py-2 text-[length:var(--step-label)] leading-relaxed text-t3">
                  Over {Math.min(sa.games, sb.games)} games this gap is inside sampling noise. Read
                  it as a tie.
                </p>
              )}
              <VersusStat label="KDA" rows={rowsFor("kda", (v) => v.toFixed(2))} />
              <VersusStat
                label="Kill participation"
                rows={rowsFor("kp", (v) => `${Math.round(v)}%`)}
              />
              <VersusStat
                label="Damage share"
                rows={rowsFor("damageShare", (v) => `${Math.round(v)}%`)}
              />
              <VersusStat label="CS per minute" rows={rowsFor("csPerMin", (v) => v.toFixed(1))} />
              <VersusStat
                label="Damage per minute"
                rows={rowsFor("dpm", (v) => Math.round(v).toLocaleString())}
              />
              <VersusStat
                label="Gold per minute"
                rows={rowsFor("goldPerMin", (v) => Math.round(v).toLocaleString())}
              />
              <VersusStat
                label="Deaths · share of team"
                rows={[
                  {
                    name: gameName(a.riotId),
                    color: colorA,
                    value: num(sa.deathShare, (v) => `${Math.round(v)}%`),
                    index: typeof sa.deathShare === "number" ? idx(sa, "deathShare") : undefined,
                    deltaLabel: deathsDelta(sa).label,
                    glyphDown: deathsDelta(sa).glyphDown,
                  },
                  {
                    name: gameName(b.riotId),
                    color: colorB,
                    value: num(sb.deathShare, (v) => `${Math.round(v)}%`),
                    index: typeof sb.deathShare === "number" ? idx(sb, "deathShare") : undefined,
                    deltaLabel: deathsDelta(sb).label,
                    glyphDown: deathsDelta(sb).glyphDown,
                  },
                ]}
              />
            </div>
            <BaselineKey className="mt-3" />
          </Section>

          {(sa.topChampions?.length || sb.topChampions?.length) && (
            <Section title="Champion pools">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { p: a, s: sa, color: colorA },
                  { p: b, s: sb, color: colorB },
                ].map(({ p, s, color }) => (
                  <div key={p.riotId} className="min-w-0">
                    <p className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: color }}
                      />
                      <span className="truncate text-[length:var(--step-ui)] text-t2">
                        {gameName(p.riotId)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(s.topChampions ?? []).map((c) => (
                        <ChampChip key={c.champion} c={c} version={version} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </ReportCard>
  );
}

/* =========================================================== 3. team draft = */

function RoleTag({ role }: { role: string }) {
  return (
    <span className="mono w-16 shrink-0 rounded-md border border-edge bg-s2 py-0.5 text-center text-[length:var(--step-label)] uppercase tracking-[0.07em] text-t2">
      {roleLabel(role)}
    </span>
  );
}

/**
 * How well an assigned role matches a player's history. The word carries the
 * meaning; only "off-role" — the one a drafter needs to notice — is tinted.
 */
function FitBadge({
  role,
  primaryRole,
  gamesInRole,
}: {
  role: string;
  primaryRole: string;
  gamesInRole: number;
}) {
  const fit =
    primaryRole === "UNKNOWN"
      ? "nodata"
      : role === primaryRole
        ? "main"
        : gamesInRole > 0
          ? "flex"
          : "off";
  const text = { main: "Main", flex: "Flex", off: "Off-role", nodata: "No data" }[fit];
  const style = {
    main: "bg-t1 text-ink",
    flex: "border border-edge2 text-t2",
    off: "border border-edge2 text-down",
    nodata: "border border-edge text-t3",
  }[fit];
  return (
    <span
      className={`mono shrink-0 rounded px-1.5 py-px text-[length:var(--step-label)] uppercase tracking-[0.06em] ${style}`}
    >
      {text}
    </span>
  );
}

function DraftChips({ label, names, struck }: { label: string; names: string[]; struck?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="label w-12 shrink-0">{label}</span>
      {names.map((n) => (
        <span
          key={n}
          className={`rounded border border-edge bg-s2 px-1.5 py-0.5 text-[length:var(--step-label)] ${
            struck ? "text-t3 line-through" : "text-t2"
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function TeamRow({
  row,
  player,
  window,
  version,
}: {
  row: AssignmentRow;
  player: TeamPlayer;
  window: string;
  version: string;
}) {
  const s = player.stats[window] ?? { games: 0 };
  return (
    <li className="rounded-lg border border-edge bg-s2/50 px-2.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <RoleTag role={row.role} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[length:var(--step-ui)] font-medium text-t1">
              {gameName(player.riotId)}
            </span>
            <FitBadge
              role={row.role}
              primaryRole={row.primaryRole}
              gamesInRole={row.gamesInRole}
            />
          </div>
          <p className="mono mt-0.5 truncate text-[length:var(--step-label)] text-t3">
            {player.rank}
            {s.roles?.length ? ` · ${rolesSummary(s.roles)}` : ""}
          </p>
        </div>
        <div className="w-24 shrink-0">
          <p className="mono text-right text-[length:var(--step-ui)] font-medium text-t1">
            {num(s.winRate, (v) => `${Math.round(v)}%`)}
          </p>
          {typeof s.winRate === "number" ? (
            <Meter index={wrIndex(s.winRate)} height={3} className="mt-1" />
          ) : (
            <p className="mono mt-0.5 text-right text-[length:var(--step-label)] text-t3">
              no games
            </p>
          )}
        </div>
      </div>

      {(s.topChampions?.length || player.mastery?.length) && (
        <div className="mt-2 space-y-1.5">
          {s.topChampions?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label w-14 shrink-0">Recent</span>
              {s.topChampions.map((c) => (
                <ChampChip key={c.champion} c={c} version={version} compact />
              ))}
            </div>
          ) : null}
          {player.mastery?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label w-14 shrink-0">Mastery</span>
              {player.mastery.map((m) => (
                <span
                  key={m.champion}
                  title={`${m.champion} · mastery ${m.level} · ${Math.round(m.points / 1000)}k points`}
                  className="inline-flex items-center gap-1 rounded-md border border-edge bg-s2 py-0.5 pl-0.5 pr-1.5"
                >
                  <ChampIcon champion={m.champion} version={version} size={16} />
                  <span className="mono text-[length:var(--step-label)] text-t2">M{m.level}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function TeamReport({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const windows = (data.windows as string[]) ?? ["10", "15"];
  const players = (data.players as TeamPlayer[]) ?? [];
  const assignment = (data.assignment as AssignmentRow[]) ?? [];
  const bans = (data.bans as string[]) ?? [];
  const enemy = (data.enemy as string[]) ?? [];
  const queue = (data.queue as string) ?? "both";
  const [window, setWindow] = useState(windows[windows.length - 1] ?? "15");

  if (players.length === 0) return null;
  const byId = new Map(players.map((p) => [p.riotId, p]));
  const lineup = [...assignment].sort((x, y) => roleRank(x.role) - roleRank(y.role));

  return (
    <ReportCard
      icon={<Icon name="lineup" size={15} />}
      label="Team draft plan"
      meta={
        <ScopeTag>
          {QUEUE_LABELS[queue] ?? "Ranked"} · {players.length} players
        </ScopeTag>
      }
    >
      {(bans.length > 0 || enemy.length > 0) && (
        <div className="space-y-1.5 border-b border-edge px-3.5 py-3 sm:px-4">
          {bans.length > 0 && <DraftChips label="Bans" names={bans} struck />}
          {enemy.length > 0 && <DraftChips label="Enemy" names={enemy} />}
        </div>
      )}

      <FilterBar>
        <FilterGroup label="Last">
          <SegmentedControl
            label="Sample size in games"
            options={windowOptions(windows)}
            value={window}
            onChange={setWindow}
            size="sm"
          />
        </FilterGroup>
      </FilterBar>

      <Section title="Suggested lineup">
        <ul className="space-y-2">
          {lineup.map((row) => {
            const player = byId.get(row.riotId);
            return player ? (
              <TeamRow
                key={row.riotId}
                row={row}
                player={player}
                window={window}
                version={version}
              />
            ) : null;
          })}
        </ul>
        <p className="mt-3 text-[length:var(--step-label)] leading-relaxed text-t3">
          Roles assigned from each player&apos;s own history. Recent shows form in the last {window}{" "}
          games; mastery shows the all-time pool. Win-rate bars are centred on 50%.
        </p>
      </Section>
    </ReportCard>
  );
}

/* ======================================================== 4. flex squad ==== */

const TEAMMATE_AXES = [...RADAR_AXES, VISION_AXIS];

const teammateRadarMetrics = (s: WindowStat): Record<string, number | undefined> => ({
  ...radarMetrics(s),
  visionScorePerMin: s.visionScorePerMin,
});

/* Role-fair impact: the mean role-relative index across the metrics that
   compare fairly between roles. Used only to ORDER the squad, never shown as a
   score — win and loss are shared in these games, so per-game contribution is
   the only thing that separates teammates. */
const IMPACT_KEYS: MetricKey[] = ["kda", "kp", "damageShare", "deathShare", "visionScorePerMin"];
function impactIndex(s: WindowStat): number {
  if (!s.games) return -1;
  const vals = IMPACT_KEYS.map((k) => roleIndex(s.primaryRole, k, s[k]));
  return vals.reduce((x, y) => x + y, 0) / vals.length;
}

const TILE_METRICS: Array<{ key: MetricKey; label: string; fmt: (v: number) => string }> = [
  { key: "kda", label: "KDA", fmt: (v) => v.toFixed(2) },
  { key: "kp", label: "KP", fmt: (v) => `${Math.round(v)}%` },
  { key: "damageShare", label: "Damage", fmt: (v) => `${Math.round(v)}%` },
  { key: "visionScorePerMin", label: "Vision", fmt: (v) => v.toFixed(2) },
  { key: "deathShare", label: "Deaths", fmt: (v) => `${Math.round(v)}%` },
];

function TeammateRow({
  rank,
  player,
  s,
  outcome,
  color,
  version,
}: {
  rank: number | null;
  player: TeammatePlayer;
  s: WindowStat;
  outcome: OutcomeKey;
  color: string;
  version: string;
}) {
  if (s.games === 0) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg border border-edge bg-s2/30 px-2.5 py-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] opacity-50"
          style={{ background: color }}
        />
        <span className="truncate text-[length:var(--step-ui)] text-t2">
          {gameName(player.riotId)}
        </span>
        <span className="mono ml-auto text-[length:var(--step-label)] text-t3">
          {outcome === "all" ? "no shared games" : `no shared ${outcome}`}
        </span>
      </li>
    );
  }

  const role = s.primaryRole ?? "UNKNOWN";
  const [one, many] = outcome === "wins" ? ["win", "wins"] : ["loss", "losses"];
  const count =
    outcome === "all"
      ? `${s.games} together · ${s.wins ?? 0}W ${s.losses ?? 0}L`
      : `${s.games} ${s.games === 1 ? one : many}`;

  return (
    <li className="rounded-lg border border-edge bg-s2/50 px-2.5 py-2.5">
      <div className="flex items-center gap-2.5">
        {rank !== null && (
          <span className="mono w-4 shrink-0 text-center text-[length:var(--step-label)] text-t3">
            {rank}
          </span>
        )}
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
        <RoleTag role={role} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--step-ui)] font-medium text-t1">
            {gameName(player.riotId)}
          </p>
          <p className="mono truncate text-[length:var(--step-label)] text-t3">{player.rank}</p>
        </div>
        <span className="mono hidden shrink-0 text-right text-[length:var(--step-label)] text-t2 sm:block">
          {count}
        </span>
      </div>
      <p className="mono mt-1 text-[length:var(--step-label)] text-t2 sm:hidden">{count}</p>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {TILE_METRICS.map((m) => (
          <StatTile
            key={m.key}
            label={m.label}
            value={num(s[m.key], m.fmt)}
            index={typeof s[m.key] === "number" ? idx(s, m.key) : undefined}
            color={color}
            {...(m.key === "deathShare"
              ? { deltaLabel: deathsDelta(s).label, deltaGlyphDown: deathsDelta(s).glyphDown }
              : {})}
          />
        ))}
      </div>

      {(s.topChampions?.length || player.playedWith.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {(s.topChampions ?? []).map((c: ChampStat) => (
            <ChampChip key={c.champion} c={c} version={version} compact />
          ))}
          {player.playedWith.length > 0 && (
            <span className="mono text-[length:var(--step-label)] text-t3">
              with {player.playedWith.map((w) => `${gameName(w.riotId)} ${w.games}`).join(" · ")}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export function TeammatesReport({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const players = (data.players as TeammatePlayer[]) ?? [];
  const totalShared = (data.totalSharedMatches as number) ?? 0;
  const noGames = (data.playersWithNoTogetherGames as string[]) ?? [];
  const sparse = Boolean(data.sparseSample);
  const [outcome, setOutcome] = useState<OutcomeKey>("all");

  if (players.length < 2) return null;

  // Colour follows the entity by its original slot, so re-sorting on outcome
  // never repaints anybody.
  const colorOf = new Map(players.map((p, i) => [p.riotId, seriesColor(i)]));

  const rows = players
    .map((player) => ({ player, s: player.together?.[outcome] ?? { games: 0 } }))
    .sort((x, y) => impactIndex(y.s) - impactIndex(x.s));

  const series: RadarSeries[] = rows
    .filter((r) => r.s.games > 0)
    .map((r) => ({
      label: gameName(r.player.riotId),
      color: colorOf.get(r.player.riotId) ?? seriesColor(0),
      role: r.s.primaryRole ?? "UNKNOWN",
      metrics: teammateRadarMetrics(r.s),
    }));

  return (
    <ReportCard
      icon={<Icon name="graph" size={15} />}
      label="Flex squad breakdown"
      meta={
        <ScopeTag>
          {totalShared} game{totalShared === 1 ? "" : "s"} together
        </ScopeTag>
      }
    >
      {sparse && (
        <p className="flex items-start gap-2 border-b border-edge px-3.5 py-2.5 text-[length:var(--step-ui)] leading-relaxed text-t2 sm:px-4">
          <span className="mt-0.5 shrink-0 text-down">
            <Icon name="alert" size={14} />
          </span>
          Fewer than five games together. Read this as a hint, not a verdict.
        </p>
      )}

      <FilterBar>
        <FilterGroup label="Games">
          <SegmentedControl
            label="Filter by outcome"
            options={OUTCOME_KEYS.map((k) => ({
              value: k,
              label: k === "all" ? "All" : k === "wins" ? "Wins" : "Losses",
            }))}
            value={outcome}
            onChange={setOutcome}
            size="sm"
          />
        </FilterGroup>
      </FilterBar>

      <Section>
        {series.length >= 2 ? (
          <StatRadar series={series} axes={TEAMMATE_AXES} title="Impact profiles" />
        ) : (
          <p className="py-4 text-center text-[length:var(--step-ui)] text-t2">
            {outcome === "all"
              ? "Not enough shared games to chart yet."
              : `Fewer than two players share ${outcome} in this pool.`}
          </p>
        )}
      </Section>

      <Section title="Ranked by per-game contribution">
        <ul className="space-y-2">
          {rows.map(({ player, s }, i) => (
            <TeammateRow
              key={player.riotId}
              rank={s.games > 0 ? i + 1 : null}
              player={player}
              s={s}
              outcome={outcome}
              color={colorOf.get(player.riotId) ?? seriesColor(0)}
              version={version}
            />
          ))}
        </ul>
        {noGames.length > 0 && (
          <p className="mt-2.5 text-[length:var(--step-label)] text-t3">
            No shared games found for {noGames.map(gameName).join(", ")}.
          </p>
        )}
        <p className="mt-3 text-[length:var(--step-label)] leading-relaxed text-t3">
          Same-team Flex games only. Win and loss are shared here, so the ranking is each
          player&apos;s contribution against their own role average — not their win rate.
        </p>
      </Section>
    </ReportCard>
  );
}
