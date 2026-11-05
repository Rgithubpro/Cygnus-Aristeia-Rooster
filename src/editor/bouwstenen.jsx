// Small form pieces shared by the customization editor.
export function Seg({ label, waarde, opties, onKies }) {
  return (
    <div className="veld">
      <span>{label}</span>
      <div className="segment klein scroll" role="radiogroup" aria-label={label}>
        {opties.map(([v, l]) => (
          <button type="button" key={v} role="radio" aria-checked={waarde === v} aria-selected={waarde === v} onClick={() => onKies(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Schakel({ label, aan, onWissel, uitleg, uit = false }) {
  return (
    <label className="vink">
      <input type="checkbox" checked={!!aan} disabled={uit} onChange={(e) => onWissel(e.target.checked)} />
      <span>
        {label}
        {uitleg && <small className="note"> {uitleg}</small>}
      </span>
    </label>
  )
}

export function Kiezen({ label, waarde, opties, onKies }) {
  return (
    <label className="veld">
      <span>{label}</span>
      <select value={waarde} onChange={(e) => onKies(e.target.value)}>
        {opties.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Sectie({ titel, uitleg, children }) {
  return (
    <section className="card stack">
      <div>
        <h3>{titel}</h3>
        {uitleg && <p className="note">{uitleg}</p>}
      </div>
      {children}
    </section>
  )
}
