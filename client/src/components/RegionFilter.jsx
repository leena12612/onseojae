export default function RegionFilter({ regions, selected, onChange }) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600
                 focus:outline-none focus:border-brand-300 cursor-pointer
                 hover:border-slate-300 transition-colors"
    >
      {regions.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}
