export default function SearchBar({ value, onChange, onSearch, large = false }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(value)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="책 제목, 저자, ISBN으로 검색..."
        className={`flex-1 bg-white border border-slate-200 rounded-xl
          ${large ? 'py-3.5 px-5 text-base' : 'py-2.5 px-4 text-sm'}
          focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
          transition-all placeholder:text-slate-400 text-slate-800`}
      />
      <button
        type="submit"
        className={`btn-primary flex-shrink-0 ${large ? 'px-8 py-3.5 text-base' : 'px-5 py-2.5 text-sm'}`}
      >
        검색
      </button>
    </form>
  )
}
