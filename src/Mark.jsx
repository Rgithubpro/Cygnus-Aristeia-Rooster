import { ZWAAN } from './marks.js'

// Cygnus the swan: real star positions, swan silhouette behind them. Uses the class accent colour.
export default function Mark({ size = 56, className = '' }) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Sterrenbeeld Zwaan">
      <g fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.6">
        {ZWAAN.vormen.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {ZWAAN.lijnen.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {ZWAAN.sterren.map(([x, y, r, naam]) =>
        naam === 'albireo' ? (
          <g key={naam}>
            <circle cx={x - 1.2} cy={y - 0.6} r={r * 0.6} fill="#ffd678" />
            <circle cx={x + 1.2} cy={y + 0.8} r={r * 0.5} fill="#82beff" />
          </g>
        ) : (
          <circle key={naam} cx={x} cy={y} r={r} fill="currentColor" />
        ),
      )}
    </svg>
  )
}
