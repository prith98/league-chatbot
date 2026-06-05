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

/** Hextech console for a single tool call: a scanning state, then structured intel. */
export function ToolCard({ part }: { part: ToolPart }) {
  const { icon, label } = meta(part);
  const done = part.state === "output-available";
  const errored = part.state === "output-error";
  const running = !done && !errored;

  return (
    <div className="relative my-2.5 overflow-hidden rounded-md border border-gold-deep/40 bg-abyss/70">
      {/* top hairline accent */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      {running && <div className="scan-bar" />}

      <div className="relative flex items-center gap-2 px-3 py-2 text-xs">
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

      {done && <ToolResult part={part} />}
      {errored && (
        <div className="border-t border-gold-deep/30 px-3 py-2 text-xs text-loss/90">
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
        <div className="space-y-1">
          {(ranked as RankedRow[]).map((r) => (
            <div key={r.queue} className="flex items-center gap-2">
              <span className="w-16 text-parch-dim">{r.queue}</span>
              <span className="font-semibold text-gold">{r.rank}</span>
              <span className="text-parch">{r.leaguePoints} LP</span>
              <span className="ml-auto text-parch">
                {r.wins}W {r.losses}L · <span className="text-cream">{r.winRate}</span>
              </span>
            </div>
          ))}
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
