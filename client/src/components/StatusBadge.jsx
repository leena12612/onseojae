export default function StatusBadge({ status, reservations, available, total, errorMsg }) {
  switch (status) {
    case 'unlimited':
      return (
        <span className="inline-flex items-center text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded px-2 py-0.5">
          무제한
        </span>
      )

    case 'available':
      return (
        <span className="inline-flex items-center text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded px-2 py-0.5">
          {total != null ? `${total - available}/${total}` : '대출'}
        </span>
      )

    case 'borrowed':
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">대출중</span>
          <button className="text-xs font-semibold bg-brand-50 text-brand-600 border border-brand-200 rounded px-2 py-0.5 hover:bg-brand-100 active:bg-brand-200 transition-colors whitespace-nowrap">
            {reservations ? `예약 ${Number(reservations).toLocaleString()}명` : '예약가능'}
          </button>
        </div>
      )

    case 'found':
      return <span className="text-xs text-slate-500">소장</span>

    case 'not_held':
      return <span className="text-xs text-slate-400">미소장</span>

    case 'unavailable':
      return <span className="text-xs text-slate-400">대출불가</span>

    case 'error':
      return <span className="text-xs text-slate-300 cursor-help" title={errorMsg || '오류'}>오류</span>

    default:
      return <span className="text-xs text-slate-300">—</span>
  }
}
