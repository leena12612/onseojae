import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import BookCard from "../components/BookCard";
import BestsellerRanking from "../components/BestsellerRanking";
import useRecentSearches from "../hooks/useRecentSearches";
import useBookmarks from "../hooks/useBookmarks";
import useRegionPreference from "../hooks/useRegionPreference";
import RegionMultiSelect from "../components/RegionMultiSelect";
import { REGIONS } from "../constants/regions";

function TypewriterText({ text, speed = 120, className }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    setDone(false);
    const timer = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(timer);
        setTimeout(() => setDone(true), 800);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="animate-blink ml-0.5">|</span>}
    </span>
  );
}

function SearchInput({ value, onChange, onSearch, large, dark }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value);
      }}
      className={`flex items-center rounded-2xl transition-all overflow-hidden ${
        large ? "h-14" : "h-11"
      } ${
        dark
          ? "bg-white/10 border border-white/15 focus-within:border-white/40 focus-within:bg-white/15"
          : "bg-white border border-slate-200 shadow-sm focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100"
      }`}
    >
      <svg
        className={`flex-shrink-0 ml-4 ${large ? "w-5 h-5" : "w-4 h-4"} ${
          dark ? "text-white/30" : "text-slate-300"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="책 제목, 저자, ISBN…"
        className={`flex-1 bg-transparent outline-none px-3 ${
          large ? "text-base" : "text-sm"
        } ${
          dark
            ? "text-white placeholder:text-white/30"
            : "text-slate-800 placeholder:text-slate-300"
        }`}
      />
      <button
        type="submit"
        className={`flex-shrink-0 font-semibold rounded-xl transition-colors m-1.5 ${
          large ? "px-3 sm:px-6 py-2.5 text-sm" : "px-3 sm:px-4 py-2 text-xs"
        } ${
          dark
            ? "bg-white text-slate-900 hover:bg-slate-100"
            : "bg-slate-900 hover:bg-slate-700 text-white"
        }`}
      >
        <span className="hidden sm:inline">검색</span>
        <svg className="sm:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </form>
  );
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [meta, setMeta] = useState({
    totalCount: 0,
    mergedCount: 0,
    pageSize: 20,
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("sim");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const isFetchingRef = useRef(false);
  const {
    recents,
    add: addRecent,
    remove: removeRecent,
    clear: clearRecents,
  } = useRecentSearches();
  const { bookmarks, toggle: toggleBookmark, clearAll: clearBookmarks } = useBookmarks();
  const [popular, setPopular] = useState([]);
  const [regions, setRegions] = useRegionPreference();

  useEffect(() => {
    axios
      .get("/api/ebooks/bookstore")
      .then(({ data }) =>
        setPopular((data.books || []).slice(0, 5).map((b) => b.title))
      )
      .catch(() => {});
  }, []);

  const fetchPage = useCallback(async (q, p = 1, s = "sim") => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const { data } = await axios.get("/api/books/search", {
        params: { q, page: p, sort: s },
      });
      const books = data.books || [];
      const total = data.totalCount || 0;
      const pageSize = data.pageSize || 10;
      const totalPages = Math.min(Math.ceil(total / pageSize), 100);
      if (p === 1) {
        setResults(books);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setResults((prev) => [...prev, ...books]);
      }
      setMeta({ totalCount: total, mergedCount: data.mergedCount || 0, pageSize });
      setPage(p);
      setHasMore(p < totalPages);
    } catch {
      if (p === 1) setResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, []);

  const handleSearch = useCallback(
    async (q) => {
      if (!q.trim()) return;
      addRecent(q);
      setSearched(true);
      setSearchParams({ q });
      setPage(1);
      setSort("sim");
      await fetchPage(q, 1, "sim");
    },
    [setSearchParams, fetchPage]
  );

  const handleSort = (s) => {
    setSort(s);
    setPage(1);
    fetchPage(searchParams.get("q") || "", 1, s);
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          isFetchingRef.current = true;
          fetchPage(searchParams.get("q") || "", page + 1, sort);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, page, sort, searchParams, fetchPage]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center gap-4">
          <a
            href="/"
            className="flex-shrink-0 select-none font-extrabold text-lg tracking-tight text-slate-900"
          >
            온서재
          </a>
          {searched && (
            <div className="flex-1">
              <SearchInput
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
              />
            </div>
          )}
          {!searched && <div className="flex-1" />}
          <div className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full pl-2.5 pr-1 py-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <Link
            to="/ebooks"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all px-3 py-1.5 rounded-full whitespace-nowrap"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            북차트
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* ── 랜딩 ── */}
        {!searched && (
          <div className="flex flex-col items-center text-center pt-24 pb-12">
            {/* 타이틀 */}
            <p className="animate-fade-in-up-1 text-sm font-medium text-slate-400 tracking-widest uppercase mb-4">
              Book Discovery
            </p>
            <h1 className="animate-flip-3d text-6xl font-extrabold tracking-tight mb-4 text-slate-950">
              온서재
            </h1>
            <p className="animate-fade-in-up-2 text-xl font-medium text-slate-600 tracking-tight mb-12">
              원하는 책을 찾고, 새로운 책을 발견하다.
            </p>

            {/* 검색창 */}
            <div className="animate-fade-in-up-3 w-full max-w-xl mb-8 relative">
              <SearchInput
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
                large
              />
            </div>

            {/* 검색어 태그 */}
            <div className="w-full max-w-xl space-y-2.5">
              {recents.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-xs text-slate-400">최근</span>
                  {recents.map((term) => (
                    <span
                      key={term}
                      className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-all"
                    >
                      <button
                        onClick={() => {
                          setQuery(term);
                          handleSearch(term);
                        }}
                      >
                        {term}
                      </button>
                      <button
                        onClick={() => removeRecent(term)}
                        className="text-slate-300 hover:text-slate-500 transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={clearRecents}
                    className="text-xs text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    전체삭제
                  </button>
                </div>
              )}
              {popular.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-xs text-slate-400">인기</span>
                  {popular.map((term, i) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        handleSearch(term);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      <span
                        className={`font-bold tabular-nums ${
                          i < 3 ? "text-slate-700" : "text-slate-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 북마크 목록 (랜딩에서만) */}
        {!searched && bookmarks.length > 0 && (
          <section className="mt-8 pt-6 pb-6 border-t border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 text-base">🔖 북마크</h2>
              <button onClick={clearBookmarks} className="text-xs text-slate-300 hover:text-slate-500 transition-colors">전체삭제</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {bookmarks.map((book) => (
                <div key={book.isbn} className="flex flex-col text-left group relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(book) }}
                    className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button onClick={() => navigate(`/book/${book.isbn}`)} className="flex flex-col text-left">
                    <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md transition-shadow mb-2">
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none" }}
                      />
                    </div>
                    <p className="text-xs font-medium text-slate-700 line-clamp-2 leading-snug">{book.title}</p>
                    <p className="text-xs text-slate-400 truncate">{book.author}</p>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 베스트셀러 랭킹 (랜딩에서만) */}
        {!searched && <BestsellerRanking onSearch={handleSearch} />}

        {/* ── 결과 상단 ── */}
        {searched && (
          <div className="pt-6 pb-4 flex items-center justify-between">
            {!loading && results.length > 0 ? (
              <p className="text-sm text-slate-400">
                <span className="text-slate-800 font-semibold">
                  {meta.totalCount.toLocaleString()}개
                </span>{" "}
                결과
                {meta.mergedCount > 0 && (
                  <span className="ml-1 text-slate-300">
                    · 중복 {meta.mergedCount}개 병합
                  </span>
                )}
              </p>
            ) : (
              <div />
            )}
            {!loading && results.length > 0 && (
              <div className="flex gap-1">
                {[
                  { id: "sim", label: "정확도" },
                  { id: "date", label: "출간일" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSort(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      sort === s.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 로딩 ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4 flex gap-4">
                <div className="skeleton w-14 h-20 flex-shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-1/4 mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 결과 ── */}
        {!loading &&
          searched &&
          (results.length === 0 ? (
            <div className="text-center py-28">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-semibold text-slate-600">검색 결과가 없어요</p>
              <p className="text-sm text-slate-400 mt-1">
                다른 검색어로 시도해 보세요
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((book) => (
                  <BookCard
                    key={`${book.isbn}-${book.platform}`}
                    book={book}
                    onClick={() => navigate(`/book/${book.isbn}`)}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                </div>
              )}
              {!hasMore && results.length > 0 && (
                <p className="text-center text-xs text-slate-300 py-8">
                  모든 결과를 불러왔습니다
                </p>
              )}
            </>
          ))}
      </main>
    </div>
  );
}
