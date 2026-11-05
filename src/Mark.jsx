// The Northern Cross (Cygnus, the swan) drawn as a constellation.
export default function Mark({ size = 56 }) {
  const stars = [
    [50, 10, 4.5], // Deneb
    [50, 44, 4],   // Sadr
    [50, 90, 4],   // Albireo
    [22, 52, 3.5], // Gienah
    [78, 36, 3.5], // Delta
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
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M50 10 L50 44 L50 90" />
        <path d="M22 52 L50 44 L78 36" />
      </g>
      <g fill="currentColor">
        {stars.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}
