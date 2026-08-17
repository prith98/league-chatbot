"use client";

import { useId, useState } from "react";
import { roleIndex, type MetricKey } from "@/lib/roleBaselines";
import { MAX_OVERLAY_SERIES, deviationLabel } from "@/lib/viz";

/* ============================================================================
   Impact profile

   A radar, because the job is shape recognition across a fixed set of axes —
   "this player is a low-death, high-vision support" is a silhouette, not a
   ranking. Every axis is role-relative, so the midpoint ring is the player's
   own role average and the outer ring is twice it. That is the same scale as
   the meters, which is why the two read as one instrument.

   Two rules the previous version broke:
     · at most three filled polygons share a plot (the palette's all-pairs limit
       — see lib/viz.ts). Four or more become small multiples.
     · every chart has a table twin. Colour is never the only way to read it.
   ========================================================================= */

export interface RadarAxis {
  key: MetricKey;
  label: string;
  /** Short form for the small-multiples key, where space is scarce. */
  short: string;
}

export const RADAR_AXES: RadarAxis[] = [
  { key: "kda", label: "KDA", short: "KDA" },
  { key: "kp", label: "Kill part.", short: "KP" },
  { key: "damageShare", label: "Dmg share", short: "DMG" },
  { key: "csPerMin", label: "CS/min", short: "CS" },
  { key: "dpm", label: "DPM", short: "DPM" },
  { key: "deathShare", label: "Survival", short: "SURV" },
];

export const VISION_AXIS: RadarAxis = {
  key: "visionScorePerMin",
  label: "Vision",
  short: "VIS",
};

export interface RadarSeries {
  label: string;
  color: string;
  /** Primary role for this slice — sets which baseline the axes divide by. */
  role: string;
  metrics: Record<string, number | undefined>;
}

/* Geometry. The viewBox is wider than it is tall so the axis labels have room
   on the left and right without shrinking the plot; the plot itself is centred.
   Labels are the short forms — a radar spoke is not the place for "Damage per
   minute", and the table view and hover readout both carry the full name. */
const W = 320;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const R = 108;
const LABEL_R = R + 20;
/* Cropped box for small multiples, which carry no labels and so need no margin. */
const TIGHT_BOX = `${CX - R - 4} ${CY - R - 4} ${2 * R + 8} ${2 * R + 8}`;

const RINGS = [0.25, 0.5, 0.75, 1];
const AVG_RING = 0.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const angle = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

function coord(i: number, n: number, r: number): [number, number] {
  const a = angle(i, n);
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}

function polygon(fractions: number[]): string {
  const n = fractions.length;
  return fractions.map((f, i) => coord(i, n, f * R).join(",")).join(" ");
}

const idxOf = (s: RadarSeries, ax: RadarAxis) => roleIndex(s.role, ax.key, s.metrics[ax.key]);
const fracOf = (s: RadarSeries, ax: RadarAxis) => clamp01(idxOf(s, ax) / 2);

/* -------------------------------------------------------------- the plot -- */

function Plot({
  series,
  axes,
  showLabels,
  onHoverAxis,
  activeAxis,
}: {
  series: RadarSeries[];
  axes: RadarAxis[];
  showLabels: boolean;
  onHoverAxis?: (i: number | null) => void;
  activeAxis?: number | null;
}) {
  const n = axes.length;
  const clipId = useId();

  return (
    <svg
      viewBox={showLabels ? `0 0 ${W} ${H}` : TIGHT_BOX}
      className="w-full"
      role="presentation"
    >
      {/* grid — solid hairlines, one shade off the surface */}
      {RINGS.map((f) => (
        <polygon
          key={f}
          points={polygon(axes.map(() => f))}
          fill="none"
          stroke={f === AVG_RING ? "var(--color-t3)" : "var(--color-edge)"}
          strokeWidth={f === AVG_RING ? 1 : 1}
          /* Dashed only on the role-average ring, where "threshold" is exactly
             what the dashes should say. Every other ring is a plain grid line. */
          strokeDasharray={f === AVG_RING ? "3 3" : undefined}
        />
      ))}

      {axes.map((ax, i) => {
        const [x, y] = coord(i, n, R);
        return (
          <line
            key={ax.key}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="var(--color-edge)"
            strokeWidth={1}
            opacity={activeAxis === i ? 0 : 1}
          />
        );
      })}
      {activeAxis != null && (
        <line
          x1={CX}
          y1={CY}
          x2={coord(activeAxis, n, R)[0]}
          y2={coord(activeAxis, n, R)[1]}
          stroke="var(--color-t3)"
          strokeWidth={1}
        />
      )}

      <defs>
        <clipPath id={clipId}>
          <circle cx={CX} cy={CY} r={R + 2} />
        </clipPath>
      </defs>

      {series.map((s) => {
        const pts = polygon(axes.map((ax) => fracOf(s, ax)));
        return (
          <g key={s.label} clipPath={`url(#${clipId})`}>
            <polygon points={pts} fill={s.color} fillOpacity={0.14} />
            <polygon
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* vertex markers, each ringed in the surface colour so overlaps separate */}
      {series.map((s) =>
        axes.map((ax, i) => {
          const [x, y] = coord(i, n, fracOf(s, ax) * R);
          return (
            <circle
              key={`${s.label}-${ax.key}`}
              cx={x}
              cy={y}
              r={activeAxis === i ? 4 : 3}
              fill={s.color}
              stroke="var(--color-s1)"
              strokeWidth={2}
            />
          );
        }),
      )}

      {showLabels &&
        axes.map((ax, i) => {
          const [x, y] = coord(i, n, LABEL_R);
          const c = Math.cos(angle(i, n));
          const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
          return (
            <text
              key={ax.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill={activeAxis === i ? "var(--color-t1)" : "var(--color-t3)"}
              className="mono"
              style={{ fontSize: 12, letterSpacing: "0.06em" }}
            >
              {ax.short}
            </text>
          );
        })}

      {/* Hover targets: a full wedge per axis, so the hit area is a slice of the
          chart rather than a 6px dot. Pointer-only — the table view below is
          the keyboard and screen-reader path. */}
      {onHoverAxis &&
        axes.map((ax, i) => {
          const half = Math.PI / n;
          const a = angle(i, n);
          const [x1, y1] = [CX + Math.cos(a - half) * (R + 24), CY + Math.sin(a - half) * (R + 24)];
          const [x2, y2] = [CX + Math.cos(a + half) * (R + 24), CY + Math.sin(a + half) * (R + 24)];
          return (
            <path
              key={`hit-${ax.key}`}
              d={`M${CX},${CY} L${x1},${y1} A${R + 24},${R + 24} 0 0 1 ${x2},${y2} Z`}
              fill="transparent"
              onMouseEnter={() => onHoverAxis(i)}
              onMouseLeave={() => onHoverAxis(null)}
            />
          );
        })}
    </svg>
  );
}

/* ------------------------------------------------------------ table twin -- */

function RadarTable({ series, axes }: { series: RadarSeries[]; axes: RadarAxis[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Impact metrics as a multiple of each player&apos;s role average
        </caption>
        <thead>
          <tr>
            <th scope="col" className="label py-1.5 pr-3 font-normal">
              Metric
            </th>
            {series.map((s) => (
              <th key={s.label} scope="col" className="label py-1.5 pr-3 text-right font-normal">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((ax) => (
            <tr key={ax.key} className="border-t border-edge">
              <th scope="row" className="py-1.5 pr-3 text-[length:var(--step-ui)] font-normal text-t2">
                {ax.label}
              </th>
              {series.map((s) => {
                const raw = s.metrics[ax.key];
                return (
                  <td
                    key={s.label}
                    className="mono py-1.5 pr-3 text-right text-[length:var(--step-ui)] text-t1"
                  >
                    {typeof raw === "number" ? (
                      <>
                        {round(raw)}
                        <span className="ml-1.5 text-t3">{deviationLabel(idxOf(s, ax))}</span>
                      </>
                    ) : (
                      <span className="text-t3">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const round = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

/* ------------------------------------------------------------- the chart -- */

export function StatRadar({
  series,
  axes = RADAR_AXES,
  title,
}: {
  series: RadarSeries[];
  axes?: RadarAxis[];
  title?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const overlay = series.length <= MAX_OVERLAY_SERIES;

  if (series.length === 0) return null;

  return (
    <figure className="m-0">
      <div className="mb-2 flex items-baseline gap-3">
        <figcaption className="label flex-1">{title ?? "Impact profile"}</figcaption>
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="mono rounded-md px-1.5 py-0.5 text-[length:var(--step-label)] uppercase tracking-[0.07em] text-t3 transition-colors hover:bg-s2 hover:text-t1"
        >
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {view === "table" ? (
        <RadarTable series={series} axes={axes} />
      ) : overlay ? (
        <div className="relative">
          <div className="mx-auto max-w-[320px]">
            <Plot
              series={series}
              axes={axes}
              showLabels
              onHoverAxis={setHover}
              activeAxis={hover}
            />
          </div>
          {/* Readout for the hovered axis — enhances, never gates. */}
          <div className="mt-1 min-h-[1.6rem] text-center" aria-hidden>
            {hover != null && (
              <span className="mono inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border border-edge bg-s2 px-2.5 py-1 text-[length:var(--step-label)]">
                <span className="text-t3">{axes[hover].label}</span>
                {series.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5 text-t1">
                    <span
                      className="inline-block h-2 w-2 rounded-[2px]"
                      style={{ background: s.color }}
                    />
                    {typeof s.metrics[axes[hover].key] === "number"
                      ? round(s.metrics[axes[hover].key] as number)
                      : "—"}
                    <span className="text-t3">{deviationLabel(idxOf(s, axes[hover]))}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Four or more players: one small plot each. Comparison happens by
           silhouette across a shared grid rather than by untangling four
           overlapping fills — which the palette cannot safely colour anyway. */
        <div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
            {series.map((s) => (
              <div key={s.label} className="min-w-0">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: s.color }}
                  />
                  <span className="truncate text-[length:var(--step-ui)] text-t1">{s.label}</span>
                </div>
                <Plot series={[s]} axes={axes} showLabels={false} />
              </div>
            ))}
          </div>
          <p className="label mt-3 leading-relaxed">
            Axes, clockwise from top: {axes.map((a) => a.short).join(" · ")}
          </p>
        </div>
      )}

      {overlay && series.length > 1 && view === "chart" && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 text-[length:var(--step-ui)] text-t2"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {view === "chart" && (
        <p className="label mt-2 text-center leading-relaxed">
          Dashed = role average · outer = 2×
        </p>
      )}
    </figure>
  );
}
