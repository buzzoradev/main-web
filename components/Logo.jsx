// Buzzora logo mark — bee visiting a daisy, drawn to match the brand's
// Instagram logo (black + honey-yellow bee, thin-stemmed flower).
export function BeeMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* flower stem */}
      <path d="M50 30 C49 40 48 48 47 56" stroke="#241C12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* daisy petals */}
      <g transform="translate(50 26)">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-7"
            rx="2.2"
            ry="6"
            transform={`rotate(${a})`}
            fill="#FBF7EF"
            stroke="#241C12"
            strokeWidth="1.1"
          />
        ))}
        <circle cx="0" cy="0" r="4.2" fill="#EFBE55" stroke="#241C12" strokeWidth="1.1" />
      </g>
      {/* bee body */}
      <g transform="rotate(38 26 30)">
        <path d="M14 30 a12 9 0 0 1 24 0 a12 9 0 0 1 -24 0 Z" fill="#EFBE55" stroke="#241C12" strokeWidth="1.6" />
        <path d="M20 21.8 c-1.4 5.4 -1.4 11 0 16.4 l4.6 0 c-1.6 -5.4 -1.6 -11 0 -16.4 Z" fill="#241C12" />
        <path d="M29 21.4 c-1.4 5.6 -1.4 11.6 0 17.2 l4.4 -0.6 c-1.3 -5.2 -1.3 -10.8 0 -16 Z" fill="#241C12" />
        {/* stinger */}
        <path d="M38 30 l5 0" stroke="#241C12" strokeWidth="1.6" strokeLinecap="round" />
        {/* head */}
        <circle cx="13" cy="30" r="4.6" fill="#241C12" />
        {/* antennae */}
        <path d="M11 26 C9 22 7 20 4.5 19" stroke="#241C12" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M13.5 25.5 C13 21.5 12 19 10 17" stroke="#241C12" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="4.5" cy="19" r="1.6" fill="#EFBE55" />
        <circle cx="10" cy="17" r="1.6" fill="#EFBE55" />
        {/* wings */}
        <ellipse cx="20" cy="17" rx="7.5" ry="4.4" transform="rotate(-28 20 17)" fill="#FBF7EF" stroke="#241C12" strokeWidth="1.5" />
        <ellipse cx="29" cy="16" rx="6" ry="3.6" transform="rotate(-14 29 16)" fill="#EFBE55" stroke="#241C12" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export default function Logo({ tagline = false, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BeeMark />
      <span className="leading-none">
        <span className="font-display text-2xl tracking-tight md:text-3xl">
          BUZZORA<span className="text-honey-500">.</span>
        </span>
        {tagline && (
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider2 opacity-60">
            From hive to heart
          </span>
        )}
      </span>
    </span>
  );
}
