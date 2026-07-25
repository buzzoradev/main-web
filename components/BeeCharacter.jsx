// Buzz — the Buzzora bee mascot. A friendly character with a face and
// flapping wings, used in the splash screen and sprinkled across the site.
// `flap` animates the wings; `expression` tweaks the face.
export default function BeeCharacter({ size = 120, flap = true, expression = "happy", className = "" }) {
  const wingBase = flap ? "origin-bottom" : "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Buzz, the Buzzora bee"
    >
      <defs>
        <radialGradient id="beeBody" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#F5D68E" />
          <stop offset="100%" stopColor="#E8A82B" />
        </radialGradient>
      </defs>

      {/* wings — behind the body, flapping */}
      <g style={{ transformOrigin: "58px 52px" }} className={flap ? "animate-wingL" : ""}>
        <ellipse cx="44" cy="40" rx="17" ry="11" transform="rotate(-28 44 40)"
          fill="#FFFFFF" stroke="#241C12" strokeWidth="2.5" opacity="0.92" />
      </g>
      <g style={{ transformOrigin: "62px 52px" }} className={flap ? "animate-wingR" : ""}>
        <ellipse cx="76" cy="40" rx="17" ry="11" transform="rotate(28 76 40)"
          fill="#FFFFFF" stroke="#241C12" strokeWidth="2.5" opacity="0.92" />
      </g>

      {/* body */}
      <ellipse cx="60" cy="66" rx="34" ry="30" fill="url(#beeBody)" stroke="#241C12" strokeWidth="3" />
      {/* stripes */}
      <path d="M60 37 a34 30 0 0 1 22 9 q-8 6 -22 6 t-22 -6 a34 30 0 0 1 22 -9Z" fill="#241C12" opacity="0.9" />
      <path d="M31 62 q29 10 58 0 v10 q-29 10 -58 0Z" fill="#241C12" opacity="0.9" />
      <path d="M40 86 q20 9 40 0 a34 30 0 0 1 -40 0Z" fill="#241C12" opacity="0.9" />

      {/* antennae */}
      <path d="M48 40 C44 28 40 24 37 21" fill="none" stroke="#241C12" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M72 40 C76 28 80 24 83 21" fill="none" stroke="#241C12" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="37" cy="20" r="3.4" fill="#F26A4C" stroke="#241C12" strokeWidth="2" />
      <circle cx="83" cy="20" r="3.4" fill="#F26A4C" stroke="#241C12" strokeWidth="2" />

      {/* face */}
      <g>
        <ellipse cx="50" cy="58" rx="5.4" ry="6" fill="#FFF" stroke="#241C12" strokeWidth="2" />
        <ellipse cx="70" cy="58" rx="5.4" ry="6" fill="#FFF" stroke="#241C12" strokeWidth="2" />
        <circle cx="51" cy="59" r="2.6" fill="#241C12" />
        <circle cx="71" cy="59" r="2.6" fill="#241C12" />
        <circle cx="52" cy="58" r="0.9" fill="#FFF" />
        <circle cx="72" cy="58" r="0.9" fill="#FFF" />
        {/* rosy cheeks */}
        <circle cx="43" cy="68" r="4" fill="#F26A4C" opacity="0.4" />
        <circle cx="77" cy="68" r="4" fill="#F26A4C" opacity="0.4" />
        {/* smile */}
        {expression === "happy" ? (
          <path d="M53 68 q7 7 14 0" fill="none" stroke="#241C12" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <circle cx="60" cy="69" r="3.2" fill="#241C12" />
        )}
      </g>
    </svg>
  );
}
