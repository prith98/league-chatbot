"use client";

import { useState } from "react";
import { championIconUrl, useDDragonVersion } from "@/lib/ddragon";
import { Icon } from "@/components/ui/icons";
import {
  ComparisonReport,
  PlayerReport,
  TeamReport,
  TeammatesReport,
} from "@/components/tools/reports";
import {
  type ChampStat,
  type ToolPart,
  toolKey,
  toolMeta,
} from "@/components/tools/types";

/* ============================================================================
   Tool rendering

   The agent runs a loop of up to twelve tool calls per answer. Rendering each
   one as an equal-weight card turned a single question into a wall of panels
   and buried the report the person actually asked for.

   So process and result are separated: lookups collapse into a quiet run log,
   and only the four analyses render as full reports.
   ========================================================================= */

/* ------------------------------------------------------------- champions -- */

export function ChampIcon({
  champion,
  size = 20,
  version,
}: {
  champion: string;
  size?: number;
  version: string;
}) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span
        className="mono grid shrink-0 place-items-center rounded bg-s3 text-[9px] text-t3"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {champion.slice(0, 2)}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={championIconUrl(champion, version)}
      alt=""
      width={size}
      height={size}
      onError={() => setOk(false)}
      className="shrink-0 rounded ring-1 ring-edge2"
      style={{ width: size, height: size }}
    />
  );
}

/** The role-relative headline for a champion chip, in place of a noisy
 *  small-sample win rate: damage share for damage roles, kill participation
 *  for supports, who deal little damage by design. */
function champDeviation(c: ChampStat): { pct: number; label: string } | null {
  const key = c.role === "UTILITY" ? "kp" : "damageShare";
  const raw = c.vsRoleAvg?.[key];
  if (!raw) return null;
  const pct = parseInt(raw, 10); // "+18% vs avg" → 18
  return Number.isNaN(pct) ? null : { pct, label: key === "kp" ? "KP" : "DMG" };
}

export function champTitle(c: ChampStat): string {
  const base =
    `${c.champion} · ${c.games} games · ${c.winRate}% win rate` +
    (typeof c.kda === "number" ? ` · ${c.kda} KDA` : "");
  const va = c.vsRoleAvg;
  if (!va) return base;
  const dev = [
    va.damageShare ? `damage ${va.damageShare}` : null,
    va.kp ? `KP ${va.kp}` : null,
    va.csPerMin ? `CS ${va.csPerMin}` : null,
  ].filter(Boolean);
  return dev.length ? `${base} — vs role average: ${dev.join(", ")}` : base;
}

export function ChampChip({
  c,
  version,
  compact = false,
}: {
  c: ChampStat;
  version: string;
  compact?: boolean;
}) {
  const dev = champDeviation(c);
  return (
    <span
      title={champTitle(c)}
      className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-s2 py-1 pl-1 pr-2"
    >
      <ChampIcon champion={c.champion} version={version} size={compact ? 16 : 18} />
      {!compact && <span className="text-[length:var(--step-ui)] text-t1">{c.champion}</span>}
      <span className="mono text-[length:var(--step-label)] text-t3">{c.games}g</span>
      {dev && (
        <span className="mono inline-flex items-center gap-0.5 text-[length:var(--step-label)] text-t2">
          <svg
            width="6"
            height="6"
            viewBox="0 0 8 8"
            aria-hidden
            style={{ color: dev.pct >= 0 ? "var(--color-up)" : "var(--color-down)" }}
          >
            <path d={dev.pct >= 0 ? "M4 0.5 7.5 7h-7z" : "M4 7.5 0.5 1h7z"} fill="currentColor" />
          </svg>
          {Math.abs(dev.pct)}% {dev.label}
        </span>
      )}
    </span>
  );
}

/* ----------------------------------------------------------- report shell -- */

export function ReportCard({
  icon,
  label,
  meta,
  running,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  running?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="animate-rise relative my-3 overflow-hidden rounded-xl border border-edge bg-s1">
      {running && <span className="sweep" aria-hidden />}
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-edge px-3.5 py-2.5 sm:px-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-s3 text-t2">
          {icon}
        </span>
        {/* The title keeps a floor width so a long scope tag wraps beneath it
            rather than truncating the name of the report. */}
        <h3 className="label min-w-[9rem] flex-1 !text-t2">{label}</h3>
        {meta}
      </header>
      {children}
    </section>
  );
}

/** The small pill in a report header carrying the query's scope. */
export function ScopeTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono shrink-0 rounded-md border border-edge bg-s2 px-2 py-0.5 text-[length:var(--step-label)] uppercase tracking-[0.07em] text-t2">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- steps ----- */

/** One line in the run log. Expands to whatever detail the tool returned. */
function StepRow({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const { icon, label } = toolMeta(part);
  const done = part.state === "output-available";
  const errored = part.state === "output-error";
  const running = !done && !errored;

  return (
    <li className="border-t border-edge first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={running}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-s2 disabled:hover:bg-transparent"
      >
        <span
          className={`shrink-0 ${errored ? "text-down" : done ? "text-t3" : "animate-breathe text-t2"}`}
        >
          <Icon name={icon} size={14} />
        </span>
        <span className="flex-1 truncate text-[length:var(--step-ui)] text-t2">{label}</span>
        <span className="mono hidden shrink-0 text-[length:var(--step-label)] text-t3 sm:block">
          {errored ? "failed" : running ? "running" : stepSummary(part)}
        </span>
        {!running && (
          <span className={`shrink-0 text-t3 transition-transform ${open ? "rotate-180" : ""}`}>
            <Icon name="chevron" size={14} />
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-edge bg-s1/60 px-3 py-2.5">
          {errored ? (
            <p className="text-[length:var(--step-ui)] text-down">{part.errorText}</p>
          ) : (
            <StepDetail part={part} />
          )}
        </div>
      )}
    </li>
  );
}

/** A single line describing what a completed step returned. */
function stepSummary(part: ToolPart): string {
  const out = part.output as Record<string, unknown> | undefined;
  if (!out) return "done";
  const key = toolKey(part);
  if (key === "lookupSummoner") return String(out.region ?? "").toUpperCase() || "done";
  if (key === "getMatchHistory") {
    const n = (out.matches as unknown[] | undefined)?.length ?? 0;
    return `${n} games`;
  }
  if (key === "getChampionMastery") {
    const n = (out.top as unknown[] | undefined)?.length ?? 0;
    return `${n} champions`;
  }
  return "done";
}

function StepDetail({ part }: { part: ToolPart }) {
  const key = toolKey(part);
  const out = part.output as Record<string, unknown> | undefined;
  if (key === "lookupSummoner" && out) return <SummonerDetail data={out} />;
  if (key === "getMatchHistory" && out) return <MatchHistoryDetail data={out} />;
  if (key === "getChampionMastery" && out) return <MasteryDetail data={out} />;
  return <RawDetail output={part.output} />;
}

interface RankedRow {
  queue: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: string;
}

function SummonerDetail({ data }: { data: Record<string, unknown> }) {
  const ranked = data.ranked;
  return (
    <div>
      <p className="text-[length:var(--step-ui)] text-t1">
        {String(data.riotId)}
        <span className="mono ml-2 text-[length:var(--step-label)] text-t3">
          Lvl {String(data.summonerLevel)} · {String(data.region).toUpperCase()}
        </span>
      </p>
      {Array.isArray(ranked) && ranked.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {(ranked as RankedRow[]).map((r) => (
            <li key={r.queue} className="flex items-baseline gap-2 text-[length:var(--step-ui)]">
              <span className="label w-20 shrink-0">{r.queue}</span>
              <span className="flex-1 text-t1">
                {r.rank}
                <span className="mono ml-1.5 text-t3">{r.leaguePoints} LP</span>
              </span>
              <span className="mono text-[length:var(--step-label)] text-t2">
                {r.wins}W {r.losses}L · {r.winRate}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[length:var(--step-ui)] text-t3">Unranked this season.</p>
      )}
    </div>
  );
}

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

function MatchHistoryDetail({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const matches = (data.matches as MatchRow[]) ?? [];
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" className="label px-1 py-1 font-normal">
              Champion
            </th>
            <th scope="col" className="label px-1 py-1 font-normal">
              Result
            </th>
            <th scope="col" className="label px-1 py-1 text-right font-normal">
              KDA
            </th>
            <th scope="col" className="label px-1 py-1 text-right font-normal">
              CS/min
            </th>
            <th scope="col" className="label px-1 py-1 text-right font-normal">
              Queue
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const win = m.result === "Win";
            return (
              <tr key={m.matchId} className="border-t border-edge">
                <td className="px-1 py-1.5">
                  <span className="flex items-center gap-2">
                    <ChampIcon champion={m.champion} version={version} size={18} />
                    <span className="text-[length:var(--step-ui)] text-t1">{m.champion}</span>
                  </span>
                </td>
                <td className="px-1 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[length:var(--step-ui)] text-t2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-[2px]"
                      style={{ background: win ? "var(--color-up)" : "var(--color-down)" }}
                    />
                    {win ? "Win" : "Loss"}
                  </span>
                </td>
                <td className="mono px-1 py-1.5 text-right text-[length:var(--step-ui)] text-t2">
                  {m.kda}
                </td>
                <td className="mono px-1 py-1.5 text-right text-[length:var(--step-ui)] text-t2">
                  {m.csPerMin}
                </td>
                <td className="mono px-1 py-1.5 text-right text-[length:var(--step-label)] text-t3">
                  {m.queue}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MasteryRow {
  champion: string;
  level: number;
  points: number;
}

function MasteryDetail({ data }: { data: Record<string, unknown> }) {
  const version = useDDragonVersion();
  const top = (data.top as MasteryRow[]) ?? [];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {top.map((m) => (
        <li
          key={m.champion}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-s2 py-1 pl-1 pr-2"
        >
          <ChampIcon champion={m.champion} version={version} size={18} />
          <span className="text-[length:var(--step-ui)] text-t1">{m.champion}</span>
          <span className="mono text-[length:var(--step-label)] text-t3">
            M{m.level} · {Math.round(m.points / 1000)}k
          </span>
        </li>
      ))}
    </ul>
  );
}

function RawDetail({ output }: { output: unknown }) {
  if (output == null) return <p className="text-[length:var(--step-ui)] text-t3">No data.</p>;
  const text = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  return (
    <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap break-words text-[length:var(--step-label)] leading-relaxed text-t2">
      {text}
    </pre>
  );
}

/** A consecutive run of lookups, presented as one quiet block. */
export function RunLog({ parts }: { parts: ToolPart[] }) {
  const running = parts.some((p) => p.state !== "output-available" && p.state !== "output-error");
  return (
    <div className="animate-rise relative my-3 overflow-hidden rounded-xl border border-edge bg-s1/60">
      {running && <span className="sweep" aria-hidden />}
      <ul>
        {parts.map((p, i) => (
          <StepRow key={i} part={p} />
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- report -- */

export function ReportView({ part }: { part: ToolPart }) {
  const { icon, label } = toolMeta(part);
  const key = toolKey(part);
  const out = part.output as Record<string, unknown> | undefined;
  const running = part.state !== "output-available" && part.state !== "output-error";

  if (part.state === "output-error") {
    return (
      <ReportCard icon={<Icon name="alert" size={15} />} label={label}>
        <p className="px-4 py-3 text-[length:var(--step-ui)] text-down">
          {part.errorText ?? "This analysis could not be completed."}
        </p>
      </ReportCard>
    );
  }

  if (running || !out) {
    return (
      <ReportCard icon={<Icon name={icon} size={15} />} label={label} running>
        <div className="px-4 py-6">
          <p className="mono text-[length:var(--step-label)] uppercase tracking-[0.07em] text-t3">
            Pulling ranked history…
          </p>
          <div className="mt-3 space-y-2" aria-hidden>
            <div className="h-2 w-2/3 rounded-full bg-s3" />
            <div className="h-2 w-1/2 rounded-full bg-s3" />
            <div className="h-2 w-3/5 rounded-full bg-s3" />
          </div>
        </div>
      </ReportCard>
    );
  }

  if (key === "analyzePlayerStats") return <PlayerReport data={out} />;
  if (key === "comparePlayerStats") return <ComparisonReport data={out} />;
  if (key === "analyzeTeam") return <TeamReport data={out} />;
  if (key === "analyzeTeammates") return <TeammatesReport data={out} />;
  return null;
}
