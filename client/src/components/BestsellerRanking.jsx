import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { findMatchingBook, cleanAuthor } from '../utils/matchBook'

const CATEGORIES = [
  { id: 'total',            label: '종합' },
  { id: 'story',            label: '소설' },
  { id: 'economy',          label: '경제/경영' },
  { id: 'self-development', label: '자기계발' },
  { id: 'poem',             label: '에세이/시' },
  { id: 'humanities',       label: '인문/교양' },
  { id: 'hobby',            label: '취미/실용' },
  { id: 'child',            label: '어린이/청소년' },
]

const cleanTitle = (title) =>
  title.replace(/\s*[\(\[][^\)\]]*오디오[^\)\]]*[\)\]]/gi, '').trim()

function BookCard({ book, onSearch }) {
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
      else if (onSearch) onSearch(searchQuery)
      else navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    } catch {
      if (onSearch) onSearch(searchQuery)
      else navigate(`/?q=${encodeURIComponent(searchQuery)}`)
    }
    finally { setSearching(false) }
  }

  return (
    <button onClick={handleClick} className="flex flex-col text-left group relative">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }} />
        <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-1 ring-black/10
          ${book.rank === 1 ? 'bg-amber-400 text-white' : book.rank <= 3 ? 'bg-slate-900 text-white' : 'bg-black/55 text-white'}`}>
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
    </button>
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

export default function BestsellerRanking({ onSearch }) {
  const now = new Date()
  const [books, setBooks]      = useState([])
  const [category, setCategory] = useState('total')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    axios.get('/api/ebooks/bookstore', {
      params: { category, year: now.getFullYear(), month: now.getMonth() + 1 }
    })
      .then(({ data }) => setBooks(data.books || []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [category])

  if (!loading && !books.length) return null

  const INITIAL = 10
  const visible = books.slice(0, INITIAL)

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-800 text-base">서점 베스트셀러</h2>
          <p className="text-xs text-slate-400 mt-0.5">{now.getFullYear()}년 {now.getMonth() + 1}월 기준</p>
        </div>
        <Link to="/ebooks?tab=bookstore"
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors">
          더보기
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              category === cat.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-9">
        {loading
          ? Array.from({ length: INITIAL }).map((_, i) => <SkeletonCard key={i} />)
          : visible.map((book, i) => <BookCard key={`${book.rank}-${i}`} book={book} onSearch={onSearch} />)
        }
      </div>

    </section>
  )
}
