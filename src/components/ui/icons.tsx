/**
 * The icon set. Hand-drawn on a 24px grid, 1.6 stroke, `currentColor` only —
 * so an icon can never introduce a hue the design system did not authorise.
 *
 * The four analysis icons are deliberately *diagrammatic* rather than
 * representational: each one is a tiny picture of the chart that analysis
 * produces (a radar polygon, two overlapping samples, a five-slot lineup, a
 * shared-games graph). A person learns the shape once and then recognises the
 * report before reading its title.
 */

export type IconName =
  | "radar"
  | "versus"
  | "lineup"
  | "graph"
  | "search"
  | "list"
  | "star"
  | "globe"
  | "check"
  | "alert"
  | "close"
  | "plus"
  | "send"
  | "stop"
  | "chevron"
  | "arrowDown"
  | "restart"
  | "external";

const PATHS: Record<IconName, React.ReactNode> = {
  // ── Analysis glyphs — each is a miniature of its own chart ──────────────
  radar: (
    <>
      <path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M12 7.3 16.9 10.2 15.9 16.3 12 17.6 8.2 15.2 7.6 9.7z" opacity={0.55} />
    </>
  ),
  versus: (
    <>
      <circle cx="9.2" cy="12" r="5.8" />
      <circle cx="14.8" cy="12" r="5.8" opacity={0.55} />
    </>
  ),
  lineup: (
    <>
      <path d="M3.6 20.4h16.8" opacity={0.45} />
      <path d="M5 16.5v-4M9.5 16.5v-8M14 16.5v-5.5M18.5 16.5v-9" />
    </>
  ),
  graph: (
    <>
      <path d="M7.3 8.4 16.7 8.4M7.9 9.9 11.4 15.9M16.1 9.9 12.6 15.9" opacity={0.55} />
      <circle cx="6" cy="7.2" r="2.3" />
      <circle cx="18" cy="7.2" r="2.3" />
      <circle cx="12" cy="18" r="2.3" />
    </>
  ),

  // ── Interface glyphs ────────────────────────────────────────────────────
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4.4 4.4" />
    </>
  ),
  list: (
    <>
      <path d="M4 7h.01M4 12h.01M4 17h.01" />
      <path d="M8.5 7H20M8.5 12H20M8.5 17H17" />
    </>
  ),
  star: <path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.6 12h16.8" />
      <path d="M12 3.6a13 13 0 0 1 0 16.8 13 13 0 0 1 0-16.8Z" />
    </>
  ),
  check: <path d="m4.8 12.6 4.6 4.6L19.2 7.4" />,
  alert: (
    <>
      <path d="M12 4.5 21 20H3z" />
      <path d="M12 10v4.2M12 17.2h.01" />
    </>
  ),
  close: <path d="M6 6 18 18M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <path d="M12 19.5V5m0 0-6 6m6-6 6 6" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
  chevron: <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />,
  arrowDown: <path d="M12 4.5v15m0 0 5.5-5.5M12 19.5 6.5 14" />,
  restart: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.2 4.6v4.6h-4.6" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5 11 13" />
      <path d="M18 14.5V19H5V6h4.5" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The brand mark: three measurements displaced from a common baseline.
 * It is the same diagram as every stat meter in the product — the identity and
 * the core interaction are literally the same picture.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* the baseline — a role's average */}
      <path d="M16 4.5v23" strokeWidth={1} opacity={0.5} />
      {/* three readings, above and below it */}
      <path d="M16 10.5h10.5" strokeWidth={2.6} />
      <path d="M16 16H6.5" strokeWidth={2.6} opacity={0.55} />
      <path d="M16 21.5h6.5" strokeWidth={2.6} opacity={0.8} />
    </svg>
  );
}
