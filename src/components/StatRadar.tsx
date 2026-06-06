"use client";

/**
 * Hextech-styled radar/spider chart, hand-rolled in SVG so it inherits the
 * theme palette via `currentColor` (no charting dependency).
 *
 * Each axis normalizes a metric to [0,1] against a fixed soft cap, so a single
 * player's radar and a two-player overlay share one honest scale. Caps are
 * deliberately generous, role-agnostic reference points — tune them here.
 */

export interface RadarAxis {
  key: string;
  label: string;
  max: number; // value that fills the axis to the outer ring
  invert?: boolean; // lower-is-better metric (e.g. death share → survivability)
}

// The six "impact" axes. Keys match the fields on a comparison WindowStat.
export const RADAR_AXES: RadarAxis[] = [
  { key: "kda", label: "KDA", max: 5 },
  { key: "kp", label: "Kill Part.", max: 80 },
  { key: "damageShare", label: "Dmg Share", max: 35 },
  { key: "csPerMin", label: "CS/min", max: 9 },
  { key: "dpm", label: "DPM", max: 1100 },
  { key: "deathShare", label: "Survival", max: 40, invert: true },
];

export interface RadarSeries {
  label: string;
  colorClass: string; // Tailwind text-* class; drives fill + stroke via currentColor
  metrics: Record<string, number | undefined>;
}

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 34; // headroom for axis labels
const RINGS = [0.25, 0.5, 0.75, 1];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function axisAngle(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n; // start at the top, go clockwise
}

function coord(i: number, n: number, r: number): [number, number] {
  const a = axisAngle(i, n);
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

function norm(axis: RadarAxis, raw: number | undefined): number {
  if (typeof raw !== "number") return 0;
  return clamp01(axis.invert ? 1 - raw / axis.max : raw / axis.max);
}

/** Build a polygon point string from a per-axis fraction (0..1). */
function polygon(fractions: number[]): string {
  const n = fractions.length;
  return fractions.map((f, i) => coord(i, n, f * RADIUS).join(",")).join(" ");
}

export function StatRadar({ series }: { series: RadarSeries[] }) {
  const n = RADAR_AXES.length;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[260px]" role="img">
        {/* concentric grid rings */}
        {RINGS.map((f) => (
          <polygon
            key={f}
            points={polygon(RADAR_AXES.map(() => f))}
            fill="none"
            className="text-gold-deep/40"
            stroke="currentColor"
            strokeWidth={0.5}
          />
        ))}

        {/* spokes */}
        {RADAR_AXES.map((ax, i) => {
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
          const fractions = RADAR_AXES.map((ax) => norm(ax, s.metrics[ax.key]));
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
                return <circle key={RADAR_AXES[i].key} cx={x} cy={y} r={1.8} fill="currentColor" />;
              })}
            </g>
          );
        })}

        {/* axis labels */}
        {RADAR_AXES.map((ax, i) => {
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
    </div>
  );
}
