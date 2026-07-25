// Illustrated honey jar used as product art until real brand photography is
// added. Tone comes from the product's jarTone so each variety is distinct.
export default function JarVisual({ tone = "#D99A34", label = "Honey", size = 220 }) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 200 240"
      role="img"
      aria-label={`${label} jar illustration`}
    >
      <defs>
        <linearGradient id={`honey-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.85" />
          <stop offset="100%" stopColor={tone} />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="18%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* lid */}
      <rect x="52" y="26" width="96" height="26" rx="8" fill="#3A3023" />
      <rect x="56" y="20" width="88" height="12" rx="6" fill="#241C12" />
      {/* jar body */}
      <path
        d="M50 56 h100 a6 6 0 0 1 6 6 v10 c8 10 12 22 12 36 v96 a28 28 0 0 1 -28 28 H60 a28 28 0 0 1 -28 -28 v-96 c0 -14 4 -26 12 -36 v-10 a6 6 0 0 1 6 -6 Z"
        fill="#F7EFDD"
        stroke="#E3D5B8"
        strokeWidth="2"
      />
      {/* honey fill */}
      <path
        d="M38 96 c14 6 26 -6 42 0 s30 6 44 0 s28 -4 40 2 v106 a24 24 0 0 1 -24 24 H62 a24 24 0 0 1 -24 -24 Z"
        fill={`url(#honey-${id})`}
      />
      {/* glass shine */}
      <path
        d="M50 56 h30 v176 H60 a28 28 0 0 1 -28 -28 v-96 c0 -14 4 -26 12 -36 v-10 a6 6 0 0 1 6 -6 Z"
        fill={`url(#glass-${id})`}
      />
      {/* label band */}
      <rect x="44" y="128" width="112" height="58" rx="10" fill="#FBF7EF" stroke="#E3D5B8" strokeWidth="1.5" />
      <text x="100" y="152" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fill="#241C12" fontWeight="bold">
        BUZZORA
      </text>
      <text x="100" y="172" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" letterSpacing="1" fill="#6B5F4C">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
