"use client";

import { useId, useState } from "react";
import { PLATFORMS, platformLabel } from "@/lib/regions";
import { Button, Field, SegmentedControl, Select, TextInput } from "@/components/ui/controls";
import { Icon, type IconName } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";

/* ============================================================================
   The four analyses

   These used to be three unlabelled emoji pills above the input, each opening a
   hand-rolled overlay. They are the product's actual capabilities, so they get
   named, described, and given first-class placement — a rail on desktop, a
   sheet on mobile.
   ========================================================================= */

export type AnalysisId = "player" | "versus" | "team" | "flex";

export const ANALYSES: {
  id: AnalysisId;
  icon: IconName;
  name: string;
  blurb: string;
}[] = [
  {
    id: "player",
    icon: "radar",
    name: "Scout a player",
    blurb: "One player's recent ranked games, split by role.",
  },
  {
    id: "versus",
    icon: "versus",
    name: "Head-to-head",
    blurb: "Two players, each measured against their own role.",
  },
  {
    id: "team",
    icon: "lineup",
    name: "Plan a team draft",
    blurb: "2–5 players: who plays where, and what to pick.",
  },
  {
    id: "flex",
    icon: "graph",
    name: "Break down a flex squad",
    blurb: "Only the games your group actually played together.",
  },
];

type QueueMode = "solo" | "flex" | "both";
const QUEUE_OPTIONS = [
  { value: "solo" as const, label: "Solo/Duo" },
  { value: "flex" as const, label: "Flex" },
  { value: "both" as const, label: "Both" },
];
const queuePhrase = (q: QueueMode) =>
  q === "solo" ? "Solo/Duo" : q === "flex" ? "Flex" : "Solo/Duo + Flex";

interface PlayerField {
  riotId: string;
  region: string;
}

function RegionSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Select {...props}>
      {PLATFORMS.map((r) => (
        <option key={r} value={r}>
          {platformLabel(r)}
        </option>
      ))}
    </Select>
  );
}

/** Riot ID + region, the input pair every analysis is built from. */
function RiotIdField({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: PlayerField;
  onChange: (v: PlayerField) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className="mb-3.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12.5rem)]">
        <TextInput
          id={id}
          value={value.riotId}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ ...value, riotId: e.target.value })}
          placeholder="Name#TAG"
          autoComplete="off"
          spellCheck={false}
        />
        <RegionSelect
          aria-label={`${label} region`}
          value={value.region}
          onChange={(e) => onChange({ ...value, region: e.target.value })}
        />
      </div>
    </Field>
  );
}

function QueueField({ value, onChange }: { value: QueueMode; onChange: (v: QueueMode) => void }) {
  return (
    <Field label="Queue" className="mb-3.5">
      <SegmentedControl
        label="Queue"
        options={QUEUE_OPTIONS}
        value={value}
        onChange={onChange}
        className="w-full [&>button]:flex-1"
      />
    </Field>
  );
}

/* ------------------------------------------------------------ the picker -- */

export function AnalysisPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: AnalysisId) => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Start an analysis"
      description="Structured reports, built from live ranked data."
    >
      <ul className="space-y-2 pb-5">
        {ANALYSES.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onPick(a.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-edge bg-s2 p-3 text-left transition-colors hover:border-edge2 hover:bg-s3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-s3 text-t2">
                <Icon name={a.icon} size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[length:var(--step-body)] font-medium text-t1">
                  {a.name}
                </span>
                <span className="block text-[length:var(--step-ui)] text-t2">{a.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/* ------------------------------------------------------------- the forms -- */

/**
 * Each form composes a prompt that names the tool, the platform codes and the
 * queue explicitly, so the agent passes them straight through to the tool's Zod
 * enums instead of guessing them from natural language.
 */
export function AnalysisForms({
  active,
  onClose,
  onSubmit,
  busy,
}: {
  active: AnalysisId | null;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  busy: boolean;
}) {
  const [one, setOne] = useState<PlayerField>({ riotId: "", region: "na1" });
  const [oneQueue, setOneQueue] = useState<QueueMode>("both");

  const [a, setA] = useState<PlayerField>({ riotId: "", region: "na1" });
  const [b, setB] = useState<PlayerField>({ riotId: "", region: "na1" });
  const [vsQueue, setVsQueue] = useState<QueueMode>("both");

  const [teamRegion, setTeamRegion] = useState("na1");
  const [team, setTeam] = useState<PlayerField[]>(() =>
    Array.from({ length: 5 }, () => ({ riotId: "", region: "na1" })),
  );
  const [teamQueue, setTeamQueue] = useState<QueueMode>("both");
  const [bans, setBans] = useState("");
  const [enemy, setEnemy] = useState("");

  const [flexRegion, setFlexRegion] = useState("na1");
  const teamRegionId = useId();
  const flexRegionId = useId();
  const [flex, setFlex] = useState<string[]>(() => Array.from({ length: 5 }, () => ""));

  const teamFilled = team.filter((p) => p.riotId.trim()).length;
  const flexFilled = flex.filter((r) => r.trim()).length;

  const send = (prompt: string) => {
    onSubmit(prompt);
    onClose();
  };

  function submitPlayer() {
    const id = one.riotId.trim();
    if (!id || busy) return;
    send(
      `Scout ${id} using analyzePlayerStats with riotId "${id}", region "${one.region}" and ` +
        `queue "${oneQueue}" over their last 50 ranked ${queuePhrase(oneQueue)} games. ` +
        `Summarise their strengths, weaknesses and best champions, role-aware.`,
    );
  }

  function submitVersus() {
    const x = a.riotId.trim();
    const y = b.riotId.trim();
    if (!x || !y || busy) return;
    send(
      `Compare these two players over their last 50 ranked ${queuePhrase(vsQueue)} games ` +
        `using comparePlayerStats with queue "${vsQueue}". ` +
        `Player A: riotId "${x}", region "${a.region}". ` +
        `Player B: riotId "${y}", region "${b.region}".`,
    );
  }

  function submitTeam() {
    if (teamFilled < 2 || busy) return;
    const valid = team.filter((p) => p.riotId.trim());
    const roster = valid
      .map((p, i) => `Player ${i + 1}: riotId "${p.riotId.trim()}", region "${p.region}"`)
      .join(". ");
    send(
      `Give a team overview for these ${valid.length} players using analyzeTeam with queue ` +
        `"${teamQueue}" (their last 15 ranked ${queuePhrase(teamQueue)} games). Recommend role ` +
        `assignments, champion picks per role from each player's pool, and analyze the team ` +
        `composition. ${roster}.` +
        (bans.trim() ? ` Bans: ${bans.trim()}.` : "") +
        (enemy.trim() ? ` Enemy champions: ${enemy.trim()}.` : ""),
    );
  }

  function submitFlex() {
    if (flexFilled < 2 || busy) return;
    const valid = flex.filter((r) => r.trim());
    const roster = valid.map((r, i) => `Player ${i + 1}: riotId "${r.trim()}"`).join(". ");
    send(
      `Compare these ${valid.length} teammates across ONLY the Ranked Flex games they played ` +
        `together, using analyzeTeammates with region "${flexRegion}". Identify who is ` +
        `outperforming whom on role-fair per-game contribution (not win rate, which is shared), ` +
        `and give each player concrete playstyle adjustments to win more — use the Wins vs ` +
        `Losses split. ${roster}.`,
    );
  }

  return (
    <>
      <Sheet
        open={active === "player"}
        onClose={onClose}
        title="Scout a player"
        description="Their last 50 ranked games, filterable by role once the report loads."
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={submitPlayer}
            disabled={!one.riotId.trim() || busy}
            className="w-full"
          >
            {one.riotId.trim() ? "Build report" : "Add a Riot ID"}
          </Button>
        }
      >
        <div className="pt-1">
          <RiotIdField label="Player" value={one} onChange={setOne} autoFocus />
          <QueueField value={oneQueue} onChange={setOneQueue} />
        </div>
      </Sheet>

      <Sheet
        open={active === "versus"}
        onClose={onClose}
        title="Head-to-head"
        description="Regions can differ. Role-dependent stats are compared against each player's own role average."
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={submitVersus}
            disabled={!a.riotId.trim() || !b.riotId.trim() || busy}
            className="w-full"
          >
            {a.riotId.trim() && b.riotId.trim() ? "Compare players" : "Add both players"}
          </Button>
        }
      >
        <div className="pt-1">
          <RiotIdField label="First player" value={a} onChange={setA} autoFocus />
          <RiotIdField label="Second player" value={b} onChange={setB} />
          <QueueField value={vsQueue} onChange={setVsQueue} />
        </div>
      </Sheet>

      <Sheet
        open={active === "team"}
        onClose={onClose}
        title="Plan a team draft"
        description="Two to five players. Last 15 ranked games each."
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={submitTeam}
            disabled={teamFilled < 2 || busy}
            className="w-full"
          >
            {teamFilled < 2 ? "Add at least two players" : `Plan draft for ${teamFilled}`}
          </Button>
        }
      >
        <div className="pt-1">
          <Field label="Region" hint="applies to every row" htmlFor={teamRegionId} className="mb-3.5">
            <RegionSelect
              id={teamRegionId}
              value={teamRegion}
              onChange={(e) => {
                setTeamRegion(e.target.value);
                setTeam((prev) => prev.map((p) => ({ ...p, region: e.target.value })));
              }}
            />
          </Field>

          <Field label="Players" hint="two minimum" className="mb-3.5">
            <div className="space-y-2">
              {team.map((p, i) => (
                <TextInput
                  key={i}
                  value={p.riotId}
                  autoFocus={i === 0}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, riotId: e.target.value } : row)),
                    )
                  }
                  placeholder={`Player ${i + 1} · Name#TAG`}
                  aria-label={`Player ${i + 1} Riot ID`}
                  autoComplete="off"
                  spellCheck={false}
                />
              ))}
            </div>
          </Field>

          <QueueField value={teamQueue} onChange={setTeamQueue} />

          <Field label="Bans" hint="optional" className="mb-3.5">
            <TextInput
              value={bans}
              onChange={(e) => setBans(e.target.value)}
              placeholder="Yuumi, Zed, Darius"
              autoComplete="off"
            />
          </Field>

          <Field label="Enemy picks" hint="optional" className="mb-3.5">
            <TextInput
              value={enemy}
              onChange={(e) => setEnemy(e.target.value)}
              placeholder="Malphite, Kai'Sa"
              autoComplete="off"
            />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={active === "flex"}
        onClose={onClose}
        title="Break down a flex squad"
        description="Only the Ranked Flex games you played on the same team. Flex is region-locked."
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={submitFlex}
            disabled={flexFilled < 2 || busy}
            className="w-full"
          >
            {flexFilled < 2 ? "Add at least two players" : `Break down ${flexFilled} players`}
          </Button>
        }
      >
        <div className="pt-1">
          <Field label="Region" htmlFor={flexRegionId} className="mb-3.5">
            <RegionSelect
              id={flexRegionId}
              value={flexRegion}
              onChange={(e) => setFlexRegion(e.target.value)}
            />
          </Field>
          <Field label="Squad" hint="two minimum" className="mb-3.5">
            <div className="space-y-2">
              {flex.map((riotId, i) => (
                <TextInput
                  key={i}
                  value={riotId}
                  autoFocus={i === 0}
                  onChange={(e) =>
                    setFlex((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                  }
                  placeholder={`Player ${i + 1} · Name#TAG`}
                  aria-label={`Player ${i + 1} Riot ID`}
                  autoComplete="off"
                  spellCheck={false}
                />
              ))}
            </div>
          </Field>
        </div>
      </Sheet>
    </>
  );
}
