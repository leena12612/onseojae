export default function PriceComparison({ prices, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
        <h2 className="font-semibold text-slate-800 mb-3">가격 비교</h2>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-11 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!prices.length) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
      <h2 className="font-semibold text-slate-800 mb-3">가격 비교</h2>
      <div className="space-y-2">
        {prices.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-700 w-24 flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap">
              {p.platform}
              {p.isLowest && (
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 font-semibold leading-none">
                  최저
                </span>
              )}
            </span>

            <div className="flex items-baseline gap-1.5 flex-1">
              {!!p.discountRate && (
                <span className="text-xs font-bold text-rose-500">{p.discountRate}%</span>
              )}
              {!!p.originalPrice && p.originalPrice !== p.price && (
                <span className="text-xs text-slate-300 line-through">
                  {p.originalPrice.toLocaleString()}
                </span>
              )}
              <span className="text-sm font-bold text-slate-900">
                {p.price ? `${p.price.toLocaleString()}원` : '—'}
              </span>
            </div>

            {p.link && (
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                구매
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
