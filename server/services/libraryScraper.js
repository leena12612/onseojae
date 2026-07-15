import axios from 'axios'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'
import { createRequire } from 'module'

const LIBRARIES = createRequire(import.meta.url)('../data/libraries.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'

async function fetchHtml(url, params, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get(url, {
        params,
        headers: { 'User-Agent': UA },
        timeout: 10000,
        responseType: 'arraybuffer',
      })
      const buf = Buffer.from(res.data)
      if (buf.length === 0) return ''
      const tmp = buf.slice(0, 2000).toString('latin1')
      const charsetMatch = tmp.match(/charset=['""]?([a-zA-Z0-9\-]+)/i)
      const charset = charsetMatch ? charsetMatch[1] : 'utf-8'
      return iconv.decode(buf, charset)
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message)
      if (attempt >= retries || isTimeout) throw err
      await delay(300)
    }
  }
}

export function getLibraryList() {
  return LIBRARIES
}

// 책 하나를 조회할 때마다 등록된 모든 도서관(200여 곳)을 매번 다시 스크래핑하면
// 상대 사이트에 불필요한 부하를 준다. 같은 책+도서관 조합은 짧은 시간 내 재조회해도
// 결과가 거의 바뀌지 않으므로 캐싱해서 요청 빈도를 줄인다.
const libraryCache = new Map()
const LIBRARY_CACHE_TTL_MS = 10 * 60 * 1000 // 10분

/**
 * 단일 도서관 전자책 대출 현황 조회
 */
export async function scrapeOne(isbn, library, { title, author, force = false } = {}) {
  if (process.env.USE_MOCK !== 'false') return mockResult(library)

  const cacheKey = `${isbn}:${library.id}`
  const cached = libraryCache.get(cacheKey)
  // force(사용자가 새로고침 버튼을 누른 경우)일 때는 캐시를 건너뛰고 진짜 실시간으로 다시 조회한다
  if (!force && cached && Date.now() - cached.timestamp < LIBRARY_CACHE_TTL_MS) return cached.data

  const result = await fetchOne(library, title, author)
  libraryCache.set(cacheKey, { data: result, timestamp: Date.now() })
  return result
}

async function fetchOne(library, title, author) {
  try {
    switch (library.platform) {
      case 'kyobo':    return await scrapeKyobo(library, title, author)
      case 'kyobo_t3': return await scrapeKyoboT3(library, title, author)
      case 'yes24':    return await scrapeYes24(library, title, author)
      default:         return { ...library, status: 'unknown' }
    }
  } catch (err) {
    return { ...library, status: 'error', errorMsg: err.message }
  }
}

// ─── 교보 전자도서관 플랫폼 ────────────────────────────────────────────────────
// URL 패턴: {baseUrl}/elibrary-front/search/searchList.ink?schTxt=제목&schClst=ctts
// 대출 정보: <p class="use">[ 대출 : <strong>0/2</strong> 예약 : <strong>0</strong> ]</p>

async function scrapeKyobo(library, title, author) {
  const searchPath = library.searchPath ?? '/elibrary-front/search/searchList.ink'
  const searchQuery = title.replace(/\s*[(\[:].*/, '').trim() || title
  const searchParams = { schTxt: searchQuery, schClst: 'all', schDvsn: '000', orderByKey: '' }
  const searchLink = `${library.baseUrl}${searchPath}?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(searchQuery)}`

  const html = await fetchHtml(`${library.baseUrl}${searchPath}`, searchParams)

  const $ = cheerio.load(html)

  const { text: result, audio: audioResult } = findBestMatch($, 'ul.book_resultList li', title, author, ($el) => {
    return {
      titleText: $el.find('li.tit a').text().trim(),
      // 저자 표기 뒤에 오디오북 낭독 서비스명("들음닷컴" 등)이 붙어 나오는 경우가 있어
      // 오디오북 여부를 판단하는 데 방해되지 않도록 별도 뱃지로 감지한다
      authorText: $el.find('li.writer').text().trim(),
      isAudio: $el.find('span.audio').length > 0,
      useText: $el.find('p.use').text().trim(),
      link: searchLink,
    }
  })

  if (!result) {
    if (audioResult) return { ...library, status: 'audio_only', link: audioResult.link }
    return { ...library, status: 'not_held' }
  }
  if (!result.useText) return { ...library, status: 'found', link: result.link }

  return parseKyoboUseText(result.useText, library, result.link)
}

// ─── 교보 T3 플랫폼 ───────────────────────────────────────────────────────────
// URL 패턴: {baseUrl}/Kyobo_T3/Content/Content_Search.asp?total_search_keyword=제목
// 대출 정보: .service .loan .num → "1/1" (대출중/보유), .service .reserv .num → 예약수

async function scrapeKyoboT3(library, title, author) {
  const searchQuery = title.replace(/\s*[(\[:].*/, '').trim() || title
  const html = await fetchHtml(`${library.baseUrl}/Kyobo_T3/Content/Content_Search.asp`, { total_search_keyword: searchQuery, search_type: '1,2' })

  const $ = cheerio.load(html)
  const { text: result } = findBestMatch($, '#list_books ul.books_wrap li', title, author, ($el) => {
    const loanParts = $el.find('.service .loan .num').text().trim().split('/')
    const borrowed  = parseInt(loanParts[0]) || 0
    const total     = parseInt(loanParts[1]) || 0
    const reservations = parseInt($el.find('.service .reserv .num').text().trim()) || 0
    return {
      titleText:    $el.find('dl dt a').text().trim(),
      authorText:   $el.find('dl dd em').text().split('/')[0].trim(),
      borrowed,
      total,
      reservations,
      link: library.baseUrl + ($el.find('dl dt a').attr('href') || ''),
    }
  })

  if (!result) return { ...library, status: 'not_held' }

  const available = result.total - result.borrowed
  if (available > 0) return { ...library, status: 'available', available, total: result.total, reservations: result.reservations, link: result.link }
  if (result.total > 0) return { ...library, status: 'borrowed', available: 0, total: result.total, reservations: result.reservations, link: result.link }
  return { ...library, status: 'unavailable' }
}

// ─── Yes24 전자도서관 플랫폼 ──────────────────────────────────────────────────
// URL 패턴: {baseUrl}/search/?srch_order=title&src_key=제목
// 대출 정보: .stat ul li strong (순서: 보유 / 대출 / 예약)

async function scrapeYes24(library, title, author) {
  const searchQuery = title.replace(/\s*[(\[:].*/, '').trim() || title
  const html = await fetchHtml(`${library.baseUrl}/search/`, { srch_order: 'title', src_key: searchQuery })

  const $ = cheerio.load(html)
  const { text: result } = findBestMatch($, '.ebook-list .bx', title, author, ($el) => {
    const stats = $el.find('.stat ul li strong')
    return {
      titleText:    $el.find('.info .tit a').text().trim(),
      authorText:   $el.find('.info .writer').text().trim(),
      total:        parseInt(stats.eq(0).text()) || 0,
      borrowed:     parseInt(stats.eq(1).text()) || 0,
      reservations: parseInt(stats.eq(2).text()) || 0,
      link: library.baseUrl + ($el.find('.info .tit a').attr('href') || ''),
    }
  })

  if (!result) return { ...library, status: 'not_held' }

  const available = result.total - result.borrowed
  if (available > 0) return { ...library, status: 'available', available, total: result.total, reservations: result.reservations, link: result.link }
  if (result.total > 0) return { ...library, status: 'borrowed', available: 0, total: result.total, reservations: result.reservations, link: result.link }
  return { ...library, status: 'unavailable' }
}

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

// 오디오북은 종이책/전자책과 다른 상품이라 "대출가능"으로 취급하면 안 되지만,
// 아예 숨기지는 않고 별도로 추적해서 "오디오북으로는 있다"고 알려줄 수 있게 한다.
function findBestMatch($, selector, title, author, extractor) {
  let bestText = null
  let bestTextScore = 0
  let bestAudio = null
  let bestAudioScore = 0

  $(selector).each((_, el) => {
    const $el = $(el)
    const info = extractor($el)
    const authorScore = author ? similarity(info.authorText, author) : null

    // 저자 정보가 있는데 후보의 저자와 거의 겹치지 않으면 (짧은 제목이 우연히 다른 책 제목에
    // 부분 문자열로 포함되는 경우 등) 오탐이므로 후보에서 제외
    if (author && authorScore < 0.3) return

    const score = similarity(info.titleText, title) + (author ? authorScore * 0.3 : 0)

    if (info.isAudio) {
      if (score > bestAudioScore) { bestAudioScore = score; bestAudio = info }
    } else if (score > bestTextScore) {
      bestTextScore = score
      bestText = info
    }
  })

  // 제목 유사도 40% 미만이면 미소장으로 처리
  return {
    text: bestTextScore > 0.4 ? bestText : null,
    audio: bestAudioScore > 0.4 ? bestAudio : null,
  }
}

function parseKyoboUseText(useText, library, link) {
  const loanMatch    = useText.match(/대출\s*:\s*(\d+)\s*\/\s*(\d+)/)
  const reserveMatch = useText.match(/예약\s*:\s*(\d+)/)

  const borrowed     = loanMatch    ? parseInt(loanMatch[1])    : 0
  const total        = loanMatch    ? parseInt(loanMatch[2])    : 0
  const reservations = reserveMatch ? parseInt(reserveMatch[1]) : 0
  const available    = total - borrowed

  if (available > 0) return { ...library, status: 'available', available, total, reservations, link }
  if (total > 0)     return { ...library, status: 'borrowed',  available: 0, total, reservations, link }
  return { ...library, status: 'unavailable' }
}

function similarity(a, b) {
  if (!a || !b) return 0
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  const common = [...na].filter(c => nb.includes(c)).length
  return common / Math.max(na.length, nb.length)
}

function normalize(str) {
  return str.replace(/[\s\[\]()《》<>「」『』]/g, '').toLowerCase()
}

// ─── 목 데이터 ────────────────────────────────────────────────────────────────

const STATUSES = ['available', 'borrowed', 'borrowed', 'borrowed', 'unavailable']

async function mockResult(library) {
  await delay(Math.random() * 800 + 100)
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)]
  return {
    ...library,
    status,
    available:    status === 'available' ? 1 : 0,
    total:        2,
    reservations: status === 'borrowed'  ? Math.floor(Math.random() * 15) + 1 : 0,
  }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))
