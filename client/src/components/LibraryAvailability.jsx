import { useState, useEffect, useCallback, useRef } from 'react'
import StatusBadge from './StatusBadge'
import RegionFilter from './RegionFilter'
import RegionMultiSelect from './RegionMultiSelect'
import useLibraryFavorites from '../hooks/useLibraryFavorites'
import useRegionPreference from '../hooks/useRegionPreference'
import { REGIONS } from '../constants/regions'

const PLATFORM_LABEL = {
  kyobo:    '교보',
  kyobo_t3: '교보T3',
  yes24:    'Yes24',
  public:   '공공',
}

const PLATFORM_STYLES = {
  kyobo:    'bg-amber-50 text-amber-700 border border-amber-200',
  kyobo_t3: 'bg-amber-50 text-amber-700 border border-amber-200',
  yes24:    'bg-red-50 text-red-700 border border-red-200',
  public:   'bg-slate-100 text-slate-600 border border-slate-200',
}

function getPlatformLabel(platform) { return PLATFORM_LABEL[platform] || platform }
function getPlatformStyle(platform) { return PLATFORM_STYLES[platform] || 'bg-slate-50 text-slate-500 border border-slate-200' }

function StarIcon({ filled }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-colors ${filled ? 'text-amber-400' : 'text-slate-200 group-hover:text-slate-300'}`}
      viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function LibraryRow({ library, isFavorite, onToggleFavorite }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-5 hover:bg-slate-50/80 transition-colors group">
      <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
        <button
          onClick={() => onToggleFavorite(library.name)}
          className="flex-shrink-0 focus:outline-none"
          title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
        >
          <StarIcon filled={isFavorite} />
        </button>
        <span className={`text-xs rounded px-1.5 py-0.5 font-medium flex-shrink-0 ${getPlatformStyle(library.platform)}`}>
          {getPlatformLabel(library.platform)}
        </span>
        <span className="text-sm text-slate-700 truncate">{library.name}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge
          status={library.status}
          reservations={library.reservations}
          available={library.available}
          total={library.total}
          errorMsg={library.errorMsg}
        />
        {library.link && (
          <a
            href={library.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-brand-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

function RegionAccordion({ region, libraries, availableCount, totalCount, isFavorite, onToggleFavorite }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-slate-800 text-sm">{region}</span>
          {availableCount > 0 ? (
            <span className="text-xs text-emerald-600 font-medium">
              <span className="font-bold">{availableCount}</span>
              <span className="text-slate-300 mx-0.5">/</span>
              <span className="text-slate-400">{totalCount}개관</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">{totalCount}개관</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-slate-50/80 bg-slate-50/40">
          {libraries.map((lib, i) => (
            <LibraryRow
              key={`${lib.id || lib.name}-${i}`}
              library={lib}
              isFavorite={isFavorite(lib.name)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LibraryAvailability({ isbn, title, author }) {
  const [grouped, setGrouped]               = useState({})
  const [loading, setLoading]               = useState(true)
  const [total, setTotal]                   = useState(0)
  const [checkedCount, setCheckedCount]     = useState(0)
  const [availableTotal, setAvailableTotal] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState('전체')
  const esRef = useRef(null)
  const { favorites, isFavorite, toggle: toggleFavorite } = useLibraryFavorites()
  const [regionPref] = useRegionPreference()
  const [scope, setScope] = useState(regionPref)

  const connect = useCallback(() => {
    if (!title) return
    setGrouped({})
    setLoading(true)
    setTotal(0)
    setCheckedCount(0)
    setAvailableTotal(0)

    if (esRef.current) esRef.current.close()

    const params = new URLSearchParams({
      title,
      ...(author && { author }),
      ...(scope.length > 0 && { region: scope.join(',') }),
    })
    const es = new EventSource(`/api/libraries/${isbn}/stream?${params}`)
    esRef.current = es

    es.addEventListener('region', (e) => {
      const { region, libraries } = JSON.parse(e.data)
      setGrouped(prev => ({ ...prev, [region]: libraries.filter(l => l.status !== 'error' && l.status !== 'not_held') }))
    })
    es.addEventListener('progress', () => {
      setCheckedCount(c => c + 1)
    })
    es.addEventListener('count', (e) => {
      const { total } = JSON.parse(e.data)
      setTotal(total)
    })
    es.addEventListener('done', (e) => {
      const { availableCount, total } = JSON.parse(e.data)
      setAvailableTotal(availableCount)
      setTotal(total)
      setCheckedCount(total)
      setLoading(false)
      es.close()
    })
    es.addEventListener('error', (e) => {
      try { console.error('library stream error:', JSON.parse(e.data)) } catch {}
      setLoading(false)
      es.close()
    })
    es.onerror = () => { setLoading(false); es.close() }
  }, [isbn, title, author, scope])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])

  const REGION_ORDER = ['서울', '인천', '대전 / 세종', '대구', '울산', '부산', '광주', '경기', '강원', '충북 / 충남', '전북 / 전남', '경북 / 경남', '제주']
  const regions = Object.keys(grouped).sort((a, b) => {
    const ia = REGION_ORDER.indexOf(a), ib = REGION_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  const allRegions = ['전체', ...regions]
  const visibleRegions = selectedRegion === '전체' ? regions : regions.filter(r => r === selectedRegion)
  const totalLibraries = Object.values(grouped).flat().length

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h2 className="font-semibold text-slate-800 text-sm">공공도서관 소장 현황</h2>
            {!loading && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                대출가능 {availableTotal}개관
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            )}
            <RegionFilter regions={allRegions} selected={selectedRegion} onChange={setSelectedRegion} />
            {!loading && (
              <button
                onClick={() => connect()}
                className="flex items-center gap-1 text-xs text-white bg-slate-800 hover:bg-slate-700 transition-colors px-2.5 py-1.5 rounded-lg font-medium"
              >
                새로고침
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 transition-all px-3 py-1.5 rounded-full">
            <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <RegionMultiSelect
              regions={REGIONS}
              selected={scope}
              onChange={setScope}
              title="도서관 조회 지역"
            />
          </div>
          {scope.length > 0 && (
            <span className="text-xs text-slate-400">이 책에서만 적용돼요</span>
          )}
        </div>

        {loading && (
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-400 rounded-full animate-pulse w-full" />
          </div>
        )}
      </div>

      {/* 바디 */}
      {loading && totalLibraries === 0 ? (
        <LibraryListSkeleton />
      ) : visibleRegions.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <p>소장 정보가 없습니다</p>
        </div>
      ) : (
        <div>
          {/* 즐겨찾는 도서관 */}
          {favorites.length > 0 && (() => {
            const allLibs = Object.values(grouped).flat()
            const favLibs = allLibs.filter(l => favorites.includes(l.name))
            if (!favLibs.length) return null
            return (
              <div className="border-b border-slate-100">
                <div className="px-5 py-2 bg-amber-50/60">
                  <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    즐겨찾는 도서관
                  </span>
                </div>
                <div className="divide-y divide-slate-50/80 bg-amber-50/20">
                  {favLibs.map((lib, i) => (
                    <LibraryRow
                      key={`fav-${lib.name}-${i}`}
                      library={lib}
                      isFavorite={true}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )
          })()}
          {visibleRegions.map((region) => {
            const libs = grouped[region] || []
            const regionAvailable = libs.filter(l => l.status === 'available' || l.status === 'unlimited' || l.status === 'found').length
            const regionTotal = libs.length
            if (regionTotal === 0) return null
            return (
              <RegionAccordion
                key={region}
                region={region}
                libraries={libs}
                availableCount={regionAvailable}
                totalCount={regionTotal}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
              />
            )
          })}
          {loading && checkedCount > 0 && (
            <div className="px-5 py-3 flex items-center gap-2 text-xs text-slate-400 border-t border-slate-50">
              <span className="w-3 h-3 border-2 border-brand-300 border-t-transparent rounded-full animate-spin" />
              {total > 0 ? `${checkedCount} / ${total}곳 조회 중...` : '조회 중...'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LibraryListSkeleton() {
  return (
    <div className="px-5 py-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-4 w-16 rounded" />
          </div>
          <div className="skeleton h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}
