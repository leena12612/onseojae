import { useState } from 'react'

const PLATFORM_STYLE = {
  '예스24':   'bg-red-50 text-red-700 border-red-200',
  '알라딘':   'bg-blue-50 text-blue-700 border-blue-200',
  '교보문고': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Claude':   'bg-violet-100 text-violet-700 border-violet-300',
}

const PLATFORM_STAR_HEX = {
  '알라딘':   '#60a5fa',
  '예스24':   '#fb7185',
  '교보문고': '#fbbf24',
}

function HalfStar({ color }) {
  return (
    <span style={{
      background: `linear-gradient(to right, ${color} 50%, #e2e8f0 50%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }}>★</span>
  )
}

function StarRating({ rating, platform }) {
  if (!rating) return <span className="text-slate-300 text-xs">—</span>
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.25 && rating - full < 0.75
  const empty = 5 - full - (half ? 1 : 0)
  const starColor = PLATFORM_STAR_COLOR[platform] || 'text-amber-400'
  const starHex   = PLATFORM_STAR_HEX[platform]   || '#fbbf24'
  return (
    <span className={`inline-flex items-center gap-0.5 ${starColor}`}>
      {'★'.repeat(full)}
      {half && <HalfStar color={starHex} />}
      <span className="text-slate-200">{'★'.repeat(empty)}</span>
      <span className="ml-1 text-slate-600 text-xs font-medium tabular-nums">{rating.toFixed(1)}</span>
    </span>
  )
}

const KYOBO_RATING = {
  '최고예요': 5, '감동이에요': 5,
  '좋아요': 4,  '유익해요': 4, '추천해요': 4,
  '재밌어요': 4, '그저그래요': 3,
  '별로예요': 2, '실망이에요': 1,
}

const PLATFORM_STAR_COLOR = {
  '알라딘':   'text-blue-400',
  '예스24':   'text-rose-400',
  '교보문고': 'text-amber-400',
}

function ReviewItem({ review, platform }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 100
  const isLong = (review.content?.length || 0) > LIMIT
  const rating = review.rating ?? (review.title ? KYOBO_RATING[review.title] : null)
  const starColor = PLATFORM_STAR_COLOR[platform] || 'text-amber-400'

  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {review.title && (
            <span className="text-sm font-medium text-slate-700 truncate">{review.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {rating && (
            <span className={`text-xs font-semibold ${starColor}`}>{'★'.repeat(Math.round(rating))}</span>
          )}
          <span className="text-xs text-slate-400">{review.date}</span>
        </div>
      </div>
      {review.content && (
        <p className="text-xs text-slate-600 leading-relaxed">
          {expanded ? review.content : review.content.slice(0, LIMIT)}
          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="ml-1 text-brand-500 hover:underline"
            >
              {expanded ? ' 접기' : '...더보기'}
            </button>
          )}
        </p>
      )}
      <p className="text-xs text-slate-400 mt-1">{review.author}</p>
    </div>
  )
}

// AI 요약 카드 — 항상 노출
function AiSummaryCard({ platform, text }) {
  if (!text) return null
  const lines  = text.split('\n').filter(Boolean)
  const tagIdx = lines.findIndex(l => l.startsWith('#'))
  const body   = tagIdx >= 0 ? lines.slice(0, tagIdx) : lines
  const tags   = tagIdx >= 0 ? lines[tagIdx].split(' ').filter(t => t.startsWith('#')) : []
  const styleClass = PLATFORM_STYLE[platform] || 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div className="p-4 bg-violet-50 border-b border-violet-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-violet-600 flex items-center gap-1">
          <span>{platform === 'Claude' ? '✦✦' : '✦'}</span>
          {platform === 'Claude' ? 'Claude 종합 요약' : 'AI 리뷰 요약'}
        </span>
        <span className={`text-xs rounded px-1.5 py-0.5 font-medium border ${styleClass}`}>
          {platform}
        </span>
      </div>
      {body.map((line, i) => (
        <p key={i} className="text-xs text-slate-700 leading-relaxed mb-1">{line}</p>
      ))}
      {tags.length > 0 && (
        <p className="text-xs text-violet-500 mt-2">{tags.join(' ')}</p>
      )}
    </div>
  )
}

function PlatformReviews({ item }) {
  const [open, setOpen] = useState(false)
  const styleClass = PLATFORM_STYLE[item.platform] || 'bg-slate-50 text-slate-600 border-slate-200'
  const hasReviews = item.reviews?.length > 0

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => hasReviews && setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${hasReviews ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          {hasReviews && (
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {!hasReviews && <span className="w-4" />}

          <span className={`text-xs rounded px-1.5 py-0.5 font-medium border ${styleClass}`}>
            {item.platform}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StarRating rating={item.rating} platform={item.platform} />
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-brand-500 hover:underline flex-shrink-0"
            >
              전체보기
            </a>
          )}
        </div>
      </button>

      {open && hasReviews && (
        <div className="px-5 pb-2">
          {item.reviews.map((r, i) => (
            <ReviewItem key={i} review={r} platform={item.platform} />
          ))}
        </div>
      )}

      {!hasReviews && item.note && (
        <div className="px-5 pb-3 text-xs text-slate-400">{item.note}</div>
      )}
    </div>
  )
}

export default function BookReviews({ reviews, loading, flat = false }) {
  if (loading) {
    const skeleton = (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>
    )
    if (flat) return skeleton
    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm">리뷰</h2>
        </div>
        <div className="px-5 py-4">{skeleton}</div>
      </div>
    )
  }

  if (!reviews?.length) return null

  const summaries = reviews.filter(r => r.aiSummary)
  const content = (
    <>
      {summaries.length > 0 && (
        <div className={flat ? 'mb-3' : 'border-b border-slate-100'}>
          {summaries.map((item, i) => (
            <AiSummaryCard key={i} platform={item.platform} text={item.aiSummary} />
          ))}
        </div>
      )}
      <div>
        {reviews.map((item, i) => (
          <PlatformReviews key={i} item={item} />
        ))}
      </div>
    </>
  )

  if (flat) return content

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm">리뷰</h2>
      </div>
      {content}
    </div>
  )
}
