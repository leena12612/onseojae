import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { findMatchingBook, cleanAuthor } from '../utils/matchBook'
import useRegionPreference from '../hooks/useRegionPreference'
import RegionMultiSelect from '../components/RegionMultiSelect'
import { REGIONS } from '../constants/regions'

const PAGE_SIZE = 20

const cleanTitle = (title) =>
  title.replace(/\s*[\(\[][^\)\]]*오디오[^\)\]]*[\)\]]/gi, '').trim()

// ── 공공도서관 탭 ────────────────────────────────────────────────────────────

function LibraryCard({ book }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => book.isbn && navigate(`/book/${book.isbn}`)}
      className="flex flex-col text-left group">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
        {book.coverUrl
          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          : <BookPlaceholder />
        }
        <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-1 ring-black/10
          ${book.rank === 1 ? 'bg-amber-400 text-white' : book.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-black/50 text-white'}`}>
          {book.rank}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{book.author}</p>
      {book.loanCnt > 0 && (
        <p className="text-xs text-slate-400 mt-0.5">
          <span className="text-slate-600 font-medium">{book.loanCnt.toLocaleString()}</span>회 대출
        </p>
      )}
    </button>
  )
}

function LibraryTab() {
  const [books, setBooks]         = useState([])
  const [periods, setPeriods]     = useState([])
  const [range, setRange]         = useState('month')
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]     = useState(false)
  const sentinelRef  = useRef(null)
  const isFetchingRef = useRef(false)

  const load = async (p, rng) => {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const { data } = await axios.get('/api/ebooks/popular', {
        params: { page: p, size: PAGE_SIZE, range: rng },
      })
      const newBooks = data.books || []
      const tot = data.totalCount || 0
      if (p === 1) {
        setBooks(newBooks)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setBooks(prev => [...prev, ...newBooks])
      }
      if (data.periods?.length) setPeriods(data.periods)
      setPage(p)
      setHasMore(p * PAGE_SIZE < 100 && p < Math.min(Math.ceil(tot / PAGE_SIZE), 50))
    } catch {
      if (p === 1) setBooks([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      isFetchingRef.current = false
    }
  }

  useEffect(() => { load(1, 'month') }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          isFetchingRef.current = true
          load(page + 1, range)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, page, range])

  const handleRange = (rng) => { setRange(rng); load(1, rng) }

  return (
    <>
      <div className="flex items-center gap-4 border-b border-slate-100 mb-5 overflow-x-auto no-scrollbar">
        {(periods.length ? periods : [
          { id: 'day', label: '일간' }, { id: 'week', label: '주간' }, { id: 'month', label: '월간' },
        ]).map(p => (
          <button key={p.id} onClick={() => handleRange(p.id)} className={CAT_TAB(range === p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-9">
        {loading
          ? Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)
          : books.map(b => <LibraryCard key={`${b.isbn}-${b.rank}`} book={b} />)
        }
      </div>

      {!loading && books.length === 0 && <EmptyState />}

      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        </div>
      )}
      {!loading && !loadingMore && !hasMore && books.length > 0 && (
        <p className="text-center text-xs text-slate-300 py-8">모든 결과를 불러왔습니다</p>
      )}
    </>
  )
}

// ── 밀리의서재 탭 ────────────────────────────────────────────────────────────

function MillieCard({ book }) {
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)

  const handleClick = async () => {
    if (searching) return
    setSearching(true)
    const q = cleanTitle(book.title)
    const author = cleanAuthor(book.author)
    // 제목만으로 검색하면 흔한 단어(예: "인생")는 결과가 너무 많아 첫 페이지에 진짜 책이
    // 안 잡힐 수 있어서, 저자를 검색어에 같이 넣어 좁힌다.
    const searchQuery = author ? `${q} ${author}` : q
    try {
      const { data } = await axios.get('/api/books/search', { params: { q: searchQuery, page: 1 } })
      const found = findMatchingBook(data.books || [], q, author)
      if (found?.isbn) navigate(`/book/${found.isbn}`)
      else navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    } catch {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    }
    finally { setSearching(false) }
  }

  return (
    <button onClick={handleClick} className="flex flex-col text-left group relative">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
        {book.coverUrl
          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          : <BookPlaceholder />
        }
        <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-1 ring-black/10
          ${book.rank === 1 ? 'bg-amber-400 text-white' : book.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-black/50 text-white'}`}>
          {book.rank}
        </span>
        {book.rankChange === 'new' && (
          <span className="absolute top-2 right-2 text-xs font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">N</span>
        )}
        {searching && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl">
            <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{book.author}</p>
      {book.loanCount > 0 && (
        <p className="text-xs text-slate-400 mt-0.5">
          <span className="text-slate-600 font-medium">
            {book.loanCount >= 10000 ? `${(book.loanCount / 10000).toFixed(1)}만` : book.loanCount.toLocaleString()}
          </span>명 읽음
        </p>
      )}
    </button>
  )
}


const CAT_TAB = (active) =>
  `flex-shrink-0 pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all ${
    active ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
  }`

const PERIOD_BTN = (active) =>
  `text-sm transition-colors ${active ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-700'}`

const SEL = 'text-sm text-slate-500 bg-transparent outline-none cursor-pointer hover:text-slate-800 transition-colors'

function MillieTab() {
  const [books, setBooks]           = useState([])
  const [meta, setMeta]             = useState({})
  const [period, setPeriod]         = useState('day')
  const [category, setCategory]     = useState('total')
  const [contentType, setContentType] = useState('')
  const [age, setAge]               = useState('')
  const [gender, setGender]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)

  const load = async (params) => {
    setLoading(true); setError(false)
    try {
      const { data } = await axios.get('/api/ebooks/millie', { params })
      setBooks(data.books || [])
      setMeta(data)
    } catch { setError(true); setBooks([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load({ period: 'day', category: 'total' }) }, [])

  const update = (patch) => {
    const next = { period, category, contentType, age, gender, ...patch }
    if (patch.period    !== undefined) setPeriod(patch.period)
    if (patch.category  !== undefined) setCategory(patch.category)
    if (patch.contentType !== undefined) setContentType(patch.contentType)
    if (patch.age       !== undefined) setAge(patch.age)
    if (patch.gender    !== undefined) setGender(patch.gender)
    load(next)
  }

  const periods      = meta.periods      || [{ id:'day',label:'일간'},{id:'week',label:'주간'},{id:'month',label:'월간'},{id:'year',label:'연간'}]
  const categories   = meta.categories   || []
  const contentTypes = meta.contentTypes || []
  const ageOptions   = meta.ageOptions   || []
  const genderOptions= meta.genderOptions|| []

  return (
    <>
      {/* 카테고리 탭 */}
      <div className="flex gap-5 border-b border-slate-100 mb-4 overflow-x-auto no-scrollbar">
        {categories.map(c => (
          <button key={c.id} onClick={() => update({ category: c.id })} className={CAT_TAB(category === c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 보조 필터 */}
      <div className="flex items-center gap-3 mb-5">
        <select value={contentType} onChange={e => update({ contentType: e.target.value })} className={SEL}>
          <option value="">도서 종류</option>
          {contentTypes.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="text-slate-200 select-none">·</span>
        <select value={age} onChange={e => update({ age: e.target.value })} className={SEL}>
          <option value="">연령</option>
          {ageOptions.filter(o => o.id).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <span className="text-slate-200 select-none">·</span>
        <select value={gender} onChange={e => update({ gender: e.target.value })} className={SEL}>
          <option value="">성별</option>
          {genderOptions.filter(o => o.id).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <div className="flex gap-3 ml-auto">
          {periods.map(p => (
            <button key={p.id} onClick={() => update({ period: p.id })} className={PERIOD_BTN(period === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <EmptyState msg="밀리의서재 데이터를 불러올 수 없습니다" />}
      {!error && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-9">
          {loading
            ? Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)
            : books.map(b => <MillieCard key={`${b.rank}-${b.title}`} book={b} />)
          }
        </div>
      )}
      {!loading && !error && books.length === 0 && <EmptyState msg="데이터가 없습니다" />}
    </>
  )
}

// ── 공통 컴포넌트 ────────────────────────────────────────────────────────────

function BookPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center text-slate-300">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2">
      <div className="skeleton w-full aspect-[2/3] rounded-xl" />
      <div className="skeleton h-3.5 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
    </div>
  )
}

function EmptyState({ msg = '데이터를 불러올 수 없습니다' }) {
  return (
    <div className="text-center py-16">
      <p className="text-3xl mb-3">📚</p>
      <p className="font-semibold text-slate-600 text-sm">{msg}</p>
    </div>
  )
}

// ── 서점 탭 ──────────────────────────────────────────────────────────────────

function BookstoreCard({ book }) {
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)

  const handleClick = async () => {
    if (searching) return
    if (book.isbn) { navigate(`/book/${book.isbn}`); return }
    setSearching(true)
    const q = cleanTitle(book.title)
    const author = cleanAuthor(book.author)
    // 제목만으로 검색하면 흔한 단어(예: "인생")는 결과가 너무 많아 첫 페이지에 진짜 책이
    // 안 잡힐 수 있어서, 저자를 검색어에 같이 넣어 좁힌다.
    const searchQuery = author ? `${q} ${author}` : q
    try {
      const { data } = await axios.get('/api/books/search', { params: { q: searchQuery, page: 1 } })
      const found = findMatchingBook(data.books || [], q, author)
      if (found?.isbn) navigate(`/book/${found.isbn}`)
      else navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    } catch {
      navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    } finally { setSearching(false) }
  }

  return (
    <button onClick={handleClick}
      className="flex flex-col text-left group relative">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
        {book.coverUrl
          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          : <BookPlaceholder />
        }
        <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-1 ring-black/10
          ${book.rank === 1 ? 'bg-amber-400 text-white' : book.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-black/50 text-white'}`}>
          {book.rank}
        </span>
        {searching && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl">
            <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{book.author}</p>
      {book.price > 0 && (
        <p className="text-xs text-slate-500 mt-0.5 font-medium">{book.price.toLocaleString()}원</p>
      )}
    </button>
  )
}

function BookstoreTab() {
  const now = new Date()
  const [books, setBooks]         = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory]   = useState('total')
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)

  const load = async (cat, y, m) => {
    setLoading(true); setError(false)
    try {
      const { data } = await axios.get('/api/ebooks/bookstore', { params: { category: cat, year: y, month: m } })
      setBooks(data.books || [])
      if (data.categories?.length) setCategories(data.categories)
    } catch { setError(true); setBooks([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load('total', now.getFullYear(), now.getMonth() + 1) }, [])

  const handleCategory = (c) => { setCategory(c); load(c, year, month) }
  const handleYearMonth = (y, m) => { setYear(y); setMonth(m); load(category, y, m) }

  const years  = Array.from({ length: now.getFullYear() - 2008 + 1 }, (_, i) => 2008 + i).reverse()
  const months = Array.from({ length: year === now.getFullYear() ? now.getMonth() + 1 : 12 }, (_, i) => i + 1)

  return (
    <>
      {/* 카테고리 탭 */}
      <div className="flex gap-5 border-b border-slate-100 mb-4 overflow-x-auto no-scrollbar">
        {(categories.length ? categories : [{ id: 'total', label: '종합' }]).map(c => (
          <button key={c.id} onClick={() => handleCategory(c.id)} className={CAT_TAB(category === c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 년/월 */}
      <div className="flex items-center gap-3 mb-5">
        <select value={year} onChange={e => handleYearMonth(Number(e.target.value), month)} className={SEL}>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <span className="text-slate-200 select-none">·</span>
        <select value={month} onChange={e => handleYearMonth(year, Number(e.target.value))} className={SEL}>
          {months.map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">서점 3사 주간 베스트 기준</span>
      </div>

      {error && <EmptyState msg="서점 베스트 데이터를 불러올 수 없습니다" />}
      {!error && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-9">
          {loading
            ? Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)
            : books.map(b => <BookstoreCard key={`${b.rank}-${b.title}`} book={b} />)
          }
        </div>
      )}
      {!loading && !error && books.length === 0 && <EmptyState />}
    </>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'bookstore', label: '서점 베스트' },
  { id: 'library',   label: '공공도서관' },
  { id: 'millie',    label: '밀리의서재' },
]

export default function EbooksPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'bookstore')
  const [regions, setRegions] = useRegionPreference()

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center gap-4">
          <Link to="/" className="flex-shrink-0 select-none font-extrabold text-lg tracking-tight text-slate-900">
            온서재
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈으로
          </Link>
          <div className="flex-1" />
          <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 transition-all px-3 py-1.5 rounded-full whitespace-nowrap">
            <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <RegionMultiSelect
              regions={REGIONS}
              selected={regions}
              onChange={setRegions}
              title="도서관 조회 지역"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* 타이틀 */}
        <div className="pt-8 pb-5">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">북차트</h1>
        </div>

        {/* 탭 */}
        <div className="flex gap-1.5 mb-6 border-b border-slate-100 pb-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                tab === t.id
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'library'   && <LibraryTab />}
        {tab === 'millie'    && <MillieTab />}
        {tab === 'bookstore' && <BookstoreTab />}
      </main>
    </div>
  )
}
