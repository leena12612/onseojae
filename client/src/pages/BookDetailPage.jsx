import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import PriceComparison from '../components/PriceComparison'
import LibraryAvailability from '../components/LibraryAvailability'
import BookReviews from '../components/BookReviews'
import useBookmarks from '../hooks/useBookmarks'

export default function BookDetailPage() {
  const { isbn } = useParams()
  const navigate = useNavigate()
  const [book, setBook]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [prices, setPrices]       = useState([])
  const [pricesLoading, setPricesLoading] = useState(true)
  const [reviews, setReviews]     = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [authorBooks, setAuthorBooks] = useState([])
  const [authorBooksLoading, setAuthorBooksLoading] = useState(true)
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setBook(null)
    setPricesLoading(true)
    setReviewsLoading(true)
    setAuthorBooksLoading(true)
    setPrices([])
    setReviews([])
    setAuthorBooks([])

    axios.get(`/api/books/${isbn}`)
      .then(({ data }) => {
        if (cancelled) return
        setBook(data)
        setLoading(false)

        // 가격 비교, 같은 작가의 다른 책은 책 정보만 있으면 바로 조회 가능하므로 병렬로 시작
        const priceParams = data.title ? `?title=${encodeURIComponent(data.title)}` : ''
        const pricesPromise = axios.get(`/api/books/${isbn}/prices${priceParams}`)
          .then(({ data: priceData }) => {
            const fetchedPrices = priceData.prices || []
            if (!cancelled) {
              setPrices(fetchedPrices)
              setPricesLoading(false)
            }
            return fetchedPrices
          })
          .catch(() => {
            if (!cancelled) setPricesLoading(false)
            return []
          })

        if (data.author) {
          axios.get(`/api/books/${isbn}/author-books`, { params: { author: data.author } })
            .then(({ data: d }) => { if (!cancelled) setAuthorBooks(d.books || []) })
            .catch(() => {})
            .finally(() => { if (!cancelled) setAuthorBooksLoading(false) })
        } else {
          setAuthorBooksLoading(false)
        }

        // 리뷰는 가격 응답에서 얻는 yes24Link/kyoboLink가 필요해서 가격 조회 완료 후에 시작
        pricesPromise.then((fetchedPrices) => {
          if (cancelled) return
          const yes24Link = fetchedPrices.find(p => p.platform === '예스24')?.link || ''
          const kyoboLink = fetchedPrices.find(p => p.platform === '교보문고')?.link || ''
          const params = new URLSearchParams({ title: data.title || '', yes24Link, kyoboLink }).toString()
          return axios.get(`/api/books/${isbn}/reviews?${params}`)
            .then(({ data: reviewData }) => { if (!cancelled) setReviews(reviewData.reviews || []) })
            .catch(() => {})
            .finally(() => { if (!cancelled) setReviewsLoading(false) })
        })
      })
      .catch(err => {
        console.error(err)
        if (!cancelled) {
          setLoading(false)
          setPricesLoading(false)
          setReviewsLoading(false)
          setAuthorBooksLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [isbn])

  if (loading) return <DetailSkeleton />

  if (!book) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400">도서 정보를 찾을 수 없습니다</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            홈으로
          </Link>
          <ShareButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5 pb-20">
        {/* 도서 정보 헤더 */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-6">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <div className="flex-shrink-0 w-32 h-44 sm:w-40 sm:h-56 rounded-xl overflow-hidden shadow-md bg-slate-100 mx-auto sm:mx-0">
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/160x224/e2deff/6c47ff?text=${encodeURIComponent('📖')}`
                }}
              />
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{book.title}</h1>
                <button
                  onClick={() => toggleBookmark(book)}
                  className={`flex-shrink-0 mt-1 transition-all hover:scale-110 ${isBookmarked(book.isbn) ? 'text-amber-400' : 'text-slate-300 hover:text-slate-400'}`}
                  title={isBookmarked(book.isbn) ? '북마크 해제' : '북마크'}
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill={isBookmarked(book.isbn) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
              <p className="text-slate-600 mb-0.5">{book.author}</p>
              <p className="text-sm text-slate-400 mb-0.5">{book.publisher}</p>
              <p className="text-sm text-slate-400 mb-4">ISBN {isbn}</p>
              {book.description && (() => {
                const LIMIT = 150
                const isLong = book.description.length > LIMIT
                return (
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {descExpanded || !isLong ? book.description : book.description.slice(0, LIMIT)}
                    {isLong && (
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        className="ml-1 text-brand-500 font-medium hover:underline"
                      >
                        {descExpanded ? ' 접기' : '...더보기'}
                      </button>
                    )}
                  </p>
                )
              })()}
            </div>
          </div>
        </div>

        {/* 2열 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
          {/* 왼쪽 컬럼 */}
          <div className="flex flex-col gap-5">
            <LibraryAvailability isbn={isbn} title={book.title} author={book.author} />
            <BookReviews reviews={reviews} loading={reviewsLoading} />
          </div>

          {/* 오른쪽 컬럼 */}
          <div className="flex flex-col gap-5">
            <PriceComparison prices={prices} loading={pricesLoading} />
            {authorBooksLoading ? (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
                <div className="skeleton h-4 w-28 mb-3" />
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => <div key={i} className="skeleton w-full aspect-[2/3] rounded-lg" />)}
                </div>
              </div>
            ) : authorBooks.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
                <h2 className="font-semibold text-slate-800 mb-3">같은 작가의 다른 책</h2>
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2">
                  {authorBooks.map(b => (
                    <button key={b.isbn} onClick={() => navigate(`/book/${b.isbn}`)}
                      className="flex flex-col text-left group">
                      <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-1">
                        <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      </div>
                      <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-snug">{b.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      // HTTP 등 비보안 컨텍스트에서는 navigator.clipboard가 아예 없으므로 옛날 방식으로 폴백
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-900 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-500">복사됨</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          공유
        </>
      )}
    </button>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 h-[57px]" />
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-6 flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="skeleton w-32 h-44 sm:w-40 sm:h-56 flex-shrink-0 rounded-xl mx-auto sm:mx-0" />
          <div className="flex-1 space-y-3 py-1">
            <div className="skeleton h-7 w-2/3" />
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-4 w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="skeleton h-4 w-36" />
                  <div className="skeleton h-4 w-16 rounded-full" />
                </div>
                <div className="skeleton h-1 w-full rounded-full" />
              </div>
              <div className="px-5 py-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3.5 border-b border-slate-50 last:border-0">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-3 w-3" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="skeleton h-4 w-16" />
              </div>
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-100 space-y-2">
                  <div className="skeleton h-4 w-32 mb-1" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              ))}
              <div className="px-5 py-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div className="skeleton h-4 w-20" />
                    <div className="skeleton h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
              <div className="skeleton h-4 w-16 mb-3" />
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-11 w-full rounded-lg" />)}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/[0.06] p-5">
              <div className="skeleton h-4 w-28 mb-3" />
              <div className="grid grid-cols-4 sm:grid-cols-3 gap-2">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton w-full aspect-[2/3] rounded-lg" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
