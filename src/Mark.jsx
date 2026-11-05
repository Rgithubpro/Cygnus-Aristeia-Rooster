// Cygnus' five main stars follow the swan's wings, tail and curved neck.
export default function Mark({ size = 56 }) {
  const stars = [
    [16, 50, 4.5], // Deneb
    [50, 53, 4],   // Sadr
    [80, 16, 4],   // Albireo
    [30, 84, 3.5], // Gienah
    [84, 70, 3.5], // Delta
  ]
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Sterrenbeeld Zwaan"
    >
      <path
        d="M14 50 C25 40 38 42 50 52 C57 45 64 35 68 26 C70 19 75 14 80 16 C86 18 86 24 81 27 C78 38 72 47 63 53 C75 53 83 60 89 70 C76 72 63 66 53 59 C46 68 37 77 30 86 C27 74 34 64 42 57 C31 61 21 58 14 50Z"
        fill="currentColor"
        opacity="0.2"
      />
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        <path d="M16 50 Q32 42 50 53 C62 45 71 34 80 16" strokeWidth="2.1" opacity="0.8" />
        <path d="M50 53 Q39 66 30 84" strokeWidth="2.1" opacity="0.8" />
        <path d="M50 53 Q69 55 84 70" strokeWidth="2.1" opacity="0.8" />
        <path d="M78 20 Q73 26 72 32" strokeWidth="1.5" opacity="0.65" />
        <path d="M82 15 Q86 12 88 15 Q88 18 84 20 M87 16 L92 14" strokeWidth="1.6" opacity="0.9" />
      </g>
      <g fill="currentColor">
        {stars.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}
