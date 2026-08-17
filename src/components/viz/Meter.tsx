"use client";

import { DOWN, UP, deviationLabel, displacement } from "@/lib/viz";

/* ============================================================================
   The baseline meter — the product's signature reading.

   Every number this app shows is only meaningful relative to a role: 1.3 CS a
   minute is dismal for a mid-laner and unremarkable for a support. So no value
   is ever shown as a bare figure. It is shown as a displacement from the centre
   of a track, where the centre is that player's own role average.

   Anatomy:
        ├──────────────┼████████▏     centre tick = role average (1.00×)
                       ▲              bar grows from it, never from the edge
   The direction of the bar carries the sign. Colour repeats that information
   rather than being the only carrier of it, so the reading survives greyscale,
   colour-blindness, and forced-colors mode.
   ========================================================================= */

export function Meter({
  /** Role-relative index: 1 = the role's average, higher is always better. */
  index,
  /** Series colour when the bar's job is identity; omitted = polarity colours. */
  color,
  height = 4,
  className = "",
  ariaLabel,
}: {
  index: number | undefined;
  color?: string;
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const known = typeof index === "number" && Number.isFinite(index);
  const d = known ? displacement(index) : 0;
  const clipped = known && Math.abs(index - 1) > 1;
  const positive = d >= 0;
  const width = `${Math.abs(d) * 50}%`;
  const fill = color ?? (positive ? UP : DOWN);

  return (
    <div
      className={`relative w-full rounded-full bg-edge ${className}`}
      style={{ height }}
      role="img"
      aria-label={ariaLabel ?? (known ? `${deviationLabel(index)} versus the role average` : "No reading")}
    >
      {known && d !== 0 && (
        <span
          className="meter-fill absolute top-0 block h-full"
          style={{
            width,
            left: positive ? "50%" : `calc(50% - ${width})`,
            background: fill,
            transformOrigin: positive ? "left center" : "right center",
            borderRadius: positive ? "0 2px 2px 0" : "2px 0 0 2px",
          }}
        />
      )}

      {/* Off-scale marker: the track saturates at 2× / 0.5× the role average, so
          say so rather than silently flattening an outlier into the maximum. */}
      {clipped && (
        <span
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            [positive ? "right" : "left"]: "-1px",
            width: 0,
            height: 0,
            borderTop: `${height / 2 + 1}px solid transparent`,
            borderBottom: `${height / 2 + 1}px solid transparent`,
            [positive ? "borderLeft" : "borderRight"]: `4px solid ${fill}`,
          } as React.CSSProperties}
        />
      )}

      {/* The baseline itself, drawn over the bar so it is never obscured. */}
      <span
        className="absolute left-1/2 top-1/2 w-px -translate-x-1/2 -translate-y-1/2 bg-t3"
        style={{ height: height + 5 }}
      />
    </div>
  );
}

/**
 * Direction glyph — the third, colour-independent carrier of the sign.
 *
 * Colour always means good or bad. The arrow always means the raw figure went
 * up or down. Usually those agree; for deaths they do not, and `glyphDown`
 * exists so that row can read "▼ 25%" in green — fewer deaths, which is good —
 * instead of the nonsense "▲ +33%" under a label that says Deaths.
 */
export function Delta({
  index,
  label,
  glyphDown,
}: {
  index: number;
  label?: string;
  glyphDown?: boolean;
}) {
  const good = index >= 1;
  if (!label && Math.round((index - 1) * 100) === 0) {
    return <span className="text-t3">at avg</span>;
  }
  const pointsUp = glyphDown === undefined ? good : !glyphDown;
  return (
    <span className="inline-flex items-center gap-1 text-t2">
      <svg
        width="7"
        height="7"
        viewBox="0 0 8 8"
        aria-hidden="true"
        style={{ color: good ? UP : DOWN }}
      >
        <path d={pointsUp ? "M4 0.5 7.5 7h-7z" : "M4 7.5 0.5 1h7z"} fill="currentColor" />
      </svg>
      {label ?? deviationLabel(index)}
    </span>
  );
}

/**
 * A full stat line: what was measured, the raw figure, and where it sits
 * against the role average. Used wherever there is room for a full-width row.
 */
export function Stat({
  label,
  value,
  index,
  color,
  note,
  deltaLabel,
  deltaGlyphDown,
}: {
  label: string;
  value: string;
  index?: number;
  color?: string;
  note?: string;
  /** Override the computed deviation, e.g. win rate in points rather than %. */
  deltaLabel?: string;
  /** Point the arrow down while colour still reads from the index. */
  deltaGlyphDown?: boolean;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline gap-2">
        <span className="label flex-1 truncate">{label}</span>
        <span className="mono text-[length:var(--step-body)] font-medium text-t1">{value}</span>
        <span className="mono w-[4.5rem] shrink-0 text-right text-[length:var(--step-label)]">
          {typeof index === "number" ? (
            <Delta index={index} label={deltaLabel} glyphDown={deltaGlyphDown} />
          ) : (
            <span className="text-t3">—</span>
          )}
        </span>
      </div>
      <Meter index={index} color={color} className="mt-1.5" ariaLabel={`${label}: ${value}`} />
      {note && <p className="mt-1 text-[length:var(--step-label)] text-t3">{note}</p>}
    </div>
  );
}

/**
 * The compact form, for grids of five or six readings where a full row would
 * not fit. Same anatomy, same rules, less type.
 */
export function StatTile({
  label,
  value,
  index,
  color,
  deltaLabel,
  deltaGlyphDown,
}: {
  label: string;
  value: string;
  index?: number;
  color?: string;
  deltaLabel?: string;
  deltaGlyphDown?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-s2 px-2.5 py-2">
      <div className="label truncate">{label}</div>
      <div className="mono mt-0.5 truncate text-[length:var(--step-body)] font-medium text-t1">
        {value}
      </div>
      <Meter index={index} color={color} height={3} className="mt-1.5" ariaLabel={`${label}: ${value}`} />
      <div className="mono mt-1 text-[length:var(--step-label)]">
        {typeof index === "number" ? (
          <Delta index={index} label={deltaLabel} glyphDown={deltaGlyphDown} />
        ) : (
          <span className="text-t3">—</span>
        )}
      </div>
    </div>
  );
}

/** The one-line key that makes the whole card readable. Print it once per card. */
export function BaselineKey({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[length:var(--step-label)] leading-relaxed text-t3 ${className}`}>
      Bars read against the average for each player&apos;s own role — the tick is that
      average, the track ends at half and double it.
    </p>
  );
}
