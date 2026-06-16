"use client";

import { roleIndex, type MetricKey } from "@/lib/roleBaselines";

/**
 * Hextech-styled radar/spider chart, hand-rolled in SVG so it inherits the
 * theme palette via `currentColor` (no charting dependency).
 *
 * Axes are ROLE-RELATIVE: each metric is divided by that player's role average
 * (see roleBaselines), so a support and an ADC are judged against their own
 * role's bar rather than each other's raw numbers. The 1.0× ring (role average)
 * sits at the chart's midpoint; the outer ring is 2× role average.
 */

export interface RadarAxis {
  key: MetricKey;
  label: string;
}

// The six "impact" axes. Keys match roleBaselines metric keys + WindowStat.
export const RADAR_AXES: RadarAxis[] = [
  { key: "kda", label: "KDA" },
  { key: "kp", label: "Kill Part." },
  { key: "damageShare", label: "Dmg Share" },
  { key: "csPerMin", label: "CS/min" },
  { key: "dpm", label: "DPM" },
  { key: "deathShare", label: "Survival" },
];

export interface RadarSeries {
  label: string;
  colorClass: string; // Tailwind text-* class; drives fill + stroke via currentColor
  role: string; // player's primary role for the active window — sets the baseline
  metrics: Record<string, number | undefined>;
}

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 34; // headroom for axis labels
// Ring fractions of the radius. 0.5 maps to 1.0× role average (the reference).
const RINGS = [0.25, 0.5, 0.75, 1];
const AVG_RING = 0.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function axisAngle(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n; // start at the top, go clockwise
}

function coord(i: number, n: number, r: number): [number, number] {
  const a = axisAngle(i, n);
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

// Map a role-relative index to a radius fraction: 1.0× → the avg ring (0.5),
// 2.0×+ → the outer ring, 0 → centre.
function norm(role: string, axis: RadarAxis, raw: number | undefined): number {
  return clamp01(roleIndex(role, axis.key, raw) / 2);
}

/** Build a polygon point string from a per-axis fraction (0..1). */
function polygon(fractions: number[]): string {
  const n = fractions.length;
  return fractions.map((f, i) => coord(i, n, f * RADIUS).join(",")).join(" ");
}

export function StatRadar({
  series,
  axes = RADAR_AXES,
}: {
  series: RadarSeries[];
  // Defaults to the six standard impact axes; the teammate card passes a
  // seven-axis set that adds Vision. Geometry is angle-based, so any length works.
  axes?: RadarAxis[];
}) {
  const n = axes.length;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[260px]" role="img">
        {/* concentric grid rings — the 1.0× role-average ring is highlighted */}
        {RINGS.map((f) => {
          const isAvg = f === AVG_RING;
          return (
            <polygon
              key={f}
              points={polygon(axes.map(() => f))}
              fill="none"
              className={isAvg ? "text-gold/60" : "text-gold-deep/40"}
              stroke="currentColor"
              strokeWidth={isAvg ? 0.9 : 0.5}
              strokeDasharray={isAvg ? "2 2" : undefined}
            />
          );
        })}

        {/* spokes */}
        {axes.map((ax, i) => {
          const [x, y] = coord(i, n, RADIUS);
          return (
            <line
              key={ax.key}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className="text-gold-deep/30"
              stroke="currentColor"
              strokeWidth={0.5}
            />
          );
        })}

        {/* one filled polygon per player */}
        {series.map((s) => {
          const fractions = axes.map((ax) => norm(s.role, ax, s.metrics[ax.key]));
          return (
            <g key={s.label} className={s.colorClass}>
              <polygon
                points={polygon(fractions)}
                fill="currentColor"
                fillOpacity={0.16}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              {fractions.map((f, i) => {
                const [x, y] = coord(i, n, f * RADIUS);
                return <circle key={axes[i].key} cx={x} cy={y} r={1.8} fill="currentColor" />;
              })}
            </g>
          );
        })}

        {/* axis labels */}
        {axes.map((ax, i) => {
          const [x, y] = coord(i, n, RADIUS + 16);
          const c = Math.cos(axisAngle(i, n));
          const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
          return (
            <text
              key={ax.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="text-parch"
              fill="currentColor"
              style={{ fontSize: 8 }}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap justify-center gap-3 text-[0.6rem]">
        {series.map((s) => (
          <span key={s.label} className={"flex items-center gap-1 " + s.colorClass}>
            <span className="h-2 w-2 rounded-sm" style={{ background: "currentColor" }} />
            <span className="text-cream/90">{s.label}</span>
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-center text-[0.55rem] text-parch-dim">
        Dashed ring = average for each player&apos;s role
      </p>
    </div>
  );
}
