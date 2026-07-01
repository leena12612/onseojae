import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

function BookCard({ book }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(`/book/${book.isbn}`)} className="flex flex-col text-left group">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
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

export default function NewReleases() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/rankings', { params: { queryType: 'ItemNewSpecial', categoryId: 0 } })
      .then(({ data }) => setBooks((data.books || []).slice(0, 10)))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [])

  if (!loading && !books.length) return null

  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="font-bold text-slate-800 text-base">주목할 신간</h2>
        <p className="text-xs text-slate-400 mt-0.5">알라딘 추천 신간</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : books.map(book => <BookCard key={book.isbn} book={book} />)
        }
      </div>
    </section>
  )
}
