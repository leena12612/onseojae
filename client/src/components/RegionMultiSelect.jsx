import { useState, useRef, useEffect } from 'react'

export default function RegionMultiSelect({ regions, selected, onChange, title }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggleRegion = (r) => {
    onChange(selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r])
  }

  const label = selected.length === 0
    ? '전체 지역'
    : selected.length === 1
      ? selected[0]
      : `${selected[0]} 외 ${selected.length - 1}곳`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={title}
        className="flex items-center gap-1 font-semibold cursor-pointer"
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg ring-1 ring-slate-900/[0.06] p-1.5 z-50 max-h-72 overflow-y-auto">
          <button
            type="button"
            onClick={() => onChange([])}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selected.length === 0 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            전체 지역
          </button>
          <div className="h-px bg-slate-100 my-1" />
          {regions.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs text-slate-600"
            >
              <input
                type="checkbox"
                checked={selected.includes(r)}
                onChange={() => toggleRegion(r)}
                className="rounded border-slate-300 text-brand-500 focus:ring-brand-300"
              />
              {r}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
