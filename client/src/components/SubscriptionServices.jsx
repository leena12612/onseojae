const STATUS_CONFIG = {
  available:   { icon: '✓', iconCls: 'text-emerald-500' },
  unavailable: { icon: '✗', iconCls: 'text-slate-300' },
  unknown:     { icon: '?', iconCls: 'text-slate-400' },
  error:       { icon: '⊘', iconCls: 'text-slate-300' },
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-4 h-4 rounded" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
      <div className="skeleton h-4 w-12 rounded" />
    </div>
  )
}

export default function SubscriptionServices({ subscriptions = [], loading = false }) {
  if (!loading && !subscriptions.length) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm">구독 서비스</h2>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {subscriptions.map((s, i) => {
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.unavailable
            const isAvailable = s.status === 'available'
            const isUnknown   = s.status === 'unknown'

            return (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-base w-4 text-center ${cfg.iconCls}`}>
                    {cfg.icon}
                  </span>
                  <div>
                    <span className={`text-sm font-medium ${
                      isAvailable ? 'text-slate-800' : 'text-slate-400'
                    }`}>
                      {s.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{s.type}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {isAvailable && s.link ? (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-300 hover:text-brand-500 transition-colors"
                      aria-label={`${s.name} 바로가기`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : isUnknown && s.link ? (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-brand-500 border border-slate-200 rounded px-2 py-0.5 transition-colors"
                    >
                      직접 확인
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
