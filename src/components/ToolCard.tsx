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
  lookupSummoner: { icon: "🔎", label: "Summoner lookup" },
  getMatchHistory: { icon: "📜", label: "Match history" },
  getChampionMastery: { icon: "⭐", label: "Champion mastery" },
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

/** Pretty card for a single tool call: shows progress, then structured results. */
export function ToolCard({ part }: { part: ToolPart }) {
  const { icon, label } = meta(part);
  const done = part.state === "output-available";
  const errored = part.state === "output-error";
  const running = !done && !errored;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <span>{icon}</span>
        <span className="font-medium text-slate-300">{label}</span>
        {running && <span className="ml-auto animate-pulse text-amber-300">running…</span>}
        {done && <span className="ml-auto text-emerald-400">✓</span>}
        {errored && <span className="ml-auto text-red-400">failed</span>}
      </div>

      {done && <ToolResult part={part} />}
      {errored && (
        <div className="border-t border-slate-700/60 px-3 py-2 text-xs text-red-300">
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
    <div className="border-t border-slate-700/60 px-3 py-2 text-xs">
      <div className="mb-1 text-slate-400">
        {String(data.riotId)} · Lvl {String(data.summonerLevel)} · {String(data.region)}
      </div>
      {Array.isArray(ranked) ? (
        <div className="space-y-1">
          {(ranked as RankedRow[]).map((r) => (
            <div key={r.queue} className="flex items-center gap-2">
              <span className="w-16 text-slate-400">{r.queue}</span>
              <span className="font-semibold text-amber-200">{r.rank}</span>
              <span className="text-slate-400">{r.leaguePoints} LP</span>
              <span className="ml-auto text-slate-300">
                {r.wins}W {r.losses}L · {r.winRate}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-slate-400">Unranked</span>
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
    <div className="border-t border-slate-700/60 px-2 py-1.5">
      <table className="w-full text-xs">
        <tbody>
          {matches.map((m) => (
            <tr key={m.matchId} className="border-t border-slate-800 first:border-t-0">
              <td className="py-1 pr-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={championIconUrl(m.champion, version)}
                  alt={m.champion}
                  width={22}
                  height={22}
                  className="rounded"
                />
              </td>
              <td className="pr-2">
                <span
                  className={
                    m.result === "Win" ? "font-semibold text-emerald-400" : "font-semibold text-red-400"
                  }
                >
                  {m.result === "Win" ? "W" : "L"}
                </span>
              </td>
              <td className="pr-2 text-slate-300">{m.champion}</td>
              <td className="pr-2 text-slate-400">{m.kda}</td>
              <td className="pr-2 text-slate-400">{m.csPerMin}/min</td>
              <td className="text-right text-slate-500">{m.queue}</td>
            </tr>
          ))}
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
    <div className="flex flex-wrap gap-2 border-t border-slate-700/60 px-3 py-2">
      {top.map((m) => (
        <div key={m.champion} className="flex items-center gap-1.5 rounded bg-slate-800 px-2 py-1 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={championIconUrl(m.champion, version)} alt={m.champion} width={20} height={20} className="rounded" />
          <span className="text-slate-300">{m.champion}</span>
          <span className="text-amber-300">M{m.level}</span>
          <span className="text-slate-500">{Math.round(m.points / 1000)}k</span>
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
    <div className="border-t border-slate-700/60 px-3 py-2 text-xs">
      <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-200">
        {open ? "▾ hide data" : "▸ show data"}
      </button>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] text-slate-400">
        {open ? text : preview}
      </pre>
    </div>
  );
}
