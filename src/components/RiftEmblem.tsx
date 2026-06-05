/**
 * Hextech sigil — a sword inscribed within a hexagonal rune.
 * Drawn inline so it inherits crisp gold strokes + an arcane core glow
 * at any size. Used for the brand mark and the analyst avatar.
 */
export function RiftEmblem({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rift-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ead2" />
          <stop offset="0.5" stopColor="#c8aa6e" />
          <stop offset="1" stopColor="#785a28" />
        </linearGradient>
        <radialGradient id="rift-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0ac8b9" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0ac8b9" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* arcane core glow */}
      <circle cx="50" cy="50" r="34" fill="url(#rift-core)" />

      {/* outer hexagon */}
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        stroke="url(#rift-gold)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* inscribed diamond */}
      <polygon
        points="50,20 76,50 50,80 24,50"
        stroke="#c8aa6e"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* sword */}
      <g stroke="url(#rift-gold)" strokeWidth="2.5" strokeLinecap="round">
        <line x1="50" y1="28" x2="50" y2="68" />
        <line x1="40" y1="54" x2="60" y2="54" />
      </g>
      <circle cx="50" cy="72" r="2.6" fill="#c8aa6e" />
    </svg>
  );
}
