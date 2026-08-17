"use client";

import { roleIndex } from "@/lib/roleBaselines";
import { deviationLabel } from "@/lib/viz";
import { Meter } from "@/components/viz/Meter";
import { Icon } from "@/components/ui/icons";
import { ANALYSES, type AnalysisId } from "@/components/chat/analyses";

const EXAMPLES = [
  "Who counters Darius top right now?",
  "Best build and runes for Jinx this patch",
  "What jungler should I play to carry solo queue?",
];

/**
 * The hero states the product's one idea and then demonstrates it with the
 * component that idea lives in. Both rows below are the real `Meter`, fed the
 * real role baselines — 1.3 CS a minute is exactly average for a support and
 * roughly a fifth of what a mid-laner should farm. Same figure, opposite
 * verdict. That is the whole product in one picture.
 */
function BaselineDemo() {
  const rows = [
    { role: "UTILITY", name: "Support" },
    { role: "MIDDLE", name: "Mid lane" },
  ];
  const cs = 1.3;

  return (
    <figure className="m-0 mt-8 rounded-xl border border-edge bg-s1 p-4 sm:p-5">
      <figcaption className="label">One figure · two roles</figcaption>
      <p className="mono mt-1.5 text-[length:var(--step-title)] text-t1">1.3 CS / min</p>

      <div className="mt-5 space-y-4">
        {rows.map((r) => {
          const index = roleIndex(r.role, "csPerMin", cs);
          return (
            <div key={r.role}>
              <div className="flex items-baseline gap-2">
                <span className="label flex-1">{r.name}</span>
                <span className="mono text-[length:var(--step-label)] text-t2">
                  {Math.round((index - 1) * 100) === 0 ? "at role average" : deviationLabel(index)}
                </span>
              </div>
              <Meter index={index} className="mt-1.5" ariaLabel={`${r.name}: ${cs} CS per minute`} />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[length:var(--step-ui)] leading-relaxed text-t2">
        The same number is an ordinary game for one player and a catastrophe for the other. Nothing
        here is shown as a bare figure.
      </p>
    </figure>
  );
}

export function EmptyState({
  onPick,
  onAsk,
}: {
  onPick: (id: AnalysisId) => void;
  onAsk: (text: string) => void;
}) {
  return (
    <div className="animate-rise py-8 sm:py-14">
      <p className="label">Live ranked data · current patch</p>
      <h2 className="display mt-3 text-[length:var(--step-display)] text-t1 sm:text-[length:var(--step-hero)]">
        Every stat, read
        <br />
        against its role.
      </h2>
      <p className="mt-4 max-w-[48ch] text-[length:var(--step-lead)] leading-relaxed text-t2">
        Rift Analyst pulls a player&apos;s ranked history from the Riot API and the current
        patch&apos;s meta from OP.GG, then measures every figure against the average for the role
        they actually played.
      </p>

      <BaselineDemo />

      <h3 className="label mt-10">Start an analysis</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ANALYSES.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onPick(a.id)}
              className="group flex h-full w-full items-start gap-3 rounded-xl border border-edge bg-s1 p-3.5 text-left transition-colors hover:border-edge2 hover:bg-s2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-s3 text-t2 transition-colors group-hover:text-t1">
                <Icon name={a.icon} size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[length:var(--step-body)] font-medium text-t1">
                  {a.name}
                </span>
                <span className="mt-0.5 block text-[length:var(--step-ui)] leading-snug text-t2">
                  {a.blurb}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="label mt-9">Or just ask</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="rounded-lg border border-edge bg-s1 px-3 py-2 text-left text-[length:var(--step-ui)] text-t2 transition-colors hover:border-edge2 hover:bg-s2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
