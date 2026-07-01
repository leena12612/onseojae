const PLATFORM_STYLES = {
  kyobo:  'bg-amber-50 text-amber-700',
  yes24:  'bg-red-50 text-red-600',
  aladin: 'bg-blue-50 text-blue-700',
  ridi:   'bg-violet-50 text-violet-700',
  millie: 'bg-teal-50 text-teal-700',
  default:'bg-slate-50 text-slate-500',
}

export default function BookCard({ book, onClick }) {
  const pStyle = PLATFORM_STYLES[book.platform] || PLATFORM_STYLES.default

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="card p-4 flex gap-4 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all duration-150"
    >
      {/* Cover */}
      <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-slate-100">
        <img
          src={book.coverUrl || ''}
          alt={book.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentElement.classList.add('flex', 'items-center', 'justify-center', 'text-2xl')
            e.currentTarget.parentElement.textContent = '📖'
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">
          {book.title}
        </h3>
        <p className="text-xs text-slate-400 mb-3 truncate">
          {book.author}{book.publisher ? ` · ${book.publisher}` : ''}
        </p>
        <div className="flex items-baseline gap-1.5">
          {!!book.discountRate && (
            <span className="text-xs font-bold text-rose-500">{book.discountRate}%</span>
          )}
          {!!book.originalPrice && book.originalPrice !== book.price && (
            <span className="text-xs text-slate-300 line-through">
              {book.originalPrice.toLocaleString()}원
            </span>
          )}
          {book.price && (
            <span className="text-sm font-bold text-slate-900">
              {book.price.toLocaleString()}원
            </span>
          )}
        </div>
      </div>

      {/* Platform badge */}
      <div className="flex-shrink-0 self-start pt-0.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${pStyle}`}>
          {book.platformLabel || book.platform}
        </span>
      </div>
    </div>
  )
}
