import axios from 'axios'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function fetchHtml(url, params = {}, extraHeaders = {}) {
  const res = await axios.get(url, {
    params,
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...extraHeaders },
    timeout: 10000,
    responseType: 'arraybuffer',
  })
  const buf = Buffer.from(res.data)
  if (buf.length === 0) return ''
  const tmp = buf.slice(0, 2000).toString('latin1')
  const charsetMatch = tmp.match(/charset=['""]?([a-zA-Z0-9\-]+)/i)
  const charset = charsetMatch ? charsetMatch[1] : 'utf-8'
  return iconv.decode(buf, charset)
}

// ─── 네이버 도서 API ──────────────────────────────────────────────────────────
async function scrapeNaver(isbn) {
  const clientId     = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const { data } = await axios.get('https://openapi.naver.com/v1/search/book_adv.json', {
    params: { d_isbn: isbn },
    headers: {
      'X-Naver-Client-Id':     clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    timeout: 6000,
  })

  const item = data.items?.[0]
  if (!item) return null

  const price         = parseInt(item.discount) || parseInt(item.price) || 0
  const originalPrice = parseInt(item.price) || 0
  if (!price) return null

  return { platform: '네이버', price, originalPrice, link: item.link }
}

// ─── 알라딘 TTB API ───────────────────────────────────────────────────────────
async function scrapeAladin(isbn) {
  const ttbKey = process.env.ALADIN_TTB_KEY
  if (!ttbKey) return null

  const { data } = await axios.get('http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx', {
    params: {
      ttbkey:     ttbKey,
      itemIdType: 'ISBN13',
      ItemId:     isbn,
      output:     'js',
      Version:    '20131101',
    },
    timeout: 8000,
  })

  const item = data.item?.[0]
  if (!item) return null

  return {
    platform:      '알라딘',
    price:         item.priceSales    || 0,
    originalPrice: item.priceStandard || 0,
    link:          item.link          || `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${isbn}`,
  }
}

// ─── 예스24 스크래핑 ──────────────────────────────────────────────────────────
// Yes24는 302 리다이렉트 응답의 set-cookie가 필요함
async function scrapeYes24(title) {
  if (!title) return null

  // 1) maxRedirects:0 으로 302 응답에서 직접 쿠키 캡처
  let cookies = ''
  try {
    await axios.get('https://www.yes24.com', {
      headers: { 'User-Agent': UA },
      maxRedirects: 0,
      timeout: 8000,
    })
  } catch (err) {
    const setCookie = err.response?.headers?.['set-cookie'] || []
    cookies = setCookie.map(c => c.split(';')[0]).join('; ')
  }

  // 2) 괄호 제거한 핵심 제목으로 검색
  const searchQuery = baseTitle(title) || title
  const html = await fetchHtml(
    'https://www.yes24.com/Product/Search',
    { query: searchQuery, domain: 'ALL' },
    { Cookie: cookies, Referer: 'https://www.yes24.com' },
  )

  const $ = cheerio.load(html)

  // 결과 컨테이너: ul.sGLi > li
  const items = $('ul.sGLi li').filter((_, el) => $(el).find('.gd_name').length > 0)
  if (!items.length) return null

  // 핵심 제목끼리 유사도 비교 (괄호 포함 문구 제외)
  const searchBase = baseTitle(title)
  let bestItem = null
  let bestScore = 0

  items.each((_, el) => {
    const $el = $(el)
    const rawTitle = $el.find('.gd_name').first().text().trim()
    const resultBase = baseTitle(rawTitle)
    const score = similarity(resultBase, searchBase)
    if (score > bestScore) {
      bestScore = score
      bestItem = $el
    }
  })

  // 50% 미만이면 매칭 실패 → null 반환 (엉뚱한 책 링크보다 없는 게 나음)
  if (!bestItem || bestScore < 0.5) return null

  const href = bestItem.find('.gd_name').attr('href') || ''
  const link = href.startsWith('http') ? href : `https://www.yes24.com${href}`

  const price         = parseInt(bestItem.find('.info_price .yes_b').first().text().replace(/[^0-9]/g, '')) || 0
  const originalPrice = parseInt(bestItem.find('.info_price .yes_m').first().text().replace(/[^0-9]/g, '')) || price

  if (!price) return null
  return { platform: '예스24', price, originalPrice, link }
}

// ─── 교보문고 스크래핑 ────────────────────────────────────────────────────────
// search.kyobobook.co.kr 는 서버사이드 렌더링이라 Cheerio로 파싱 가능
async function scrapeKyobo(isbn, title) {
  const searchQuery = (title || isbn).replace(/\s*[(\[:].*/, '').trim()

  const html = await fetchHtml(
    'https://search.kyobobook.co.kr/search',
    { keyword: searchQuery, gbCode: 'TOT', target: 'total' },
    { Referer: 'https://search.kyobobook.co.kr' },
  )

  const $ = cheerio.load(html)

  // 1순위: data-bid로 ISBN 정확 매칭
  let item = $(`.prod_item input[data-bid="${isbn}"]`).closest('.prod_item')

  // 2순위: 제목 유사도 매칭
  if (!item.length && title) {
    let bestScore = 0
    $('.prod_item').each((_, el) => {
      const $el = $(el)
      const itemTitle = $el.find('.prod_name').text().trim() || $el.find('.prod_info').text().trim()
      const score = similarity(itemTitle, title)
      if (score > bestScore) { bestScore = score; item = $el }
    })
    if (bestScore < 0.4) item = $()
  }

  if (!item.length) item = $('.prod_item').first()
  if (!item.length) return null

  const link = item.find('a.prod_info').attr('href') || `https://product.kyobobook.co.kr/detail/${isbn}`

  // 할인가: .prod_price .price .val  ex) "31,500"
  const price         = parseInt(item.find('.prod_price .price .val').first().text().replace(/[^0-9]/g, '')) || 0
  // 정가: .prod_price .price_normal s.val or just the s tag  ex) "35,000원"
  const originalPrice = parseInt(item.find('.prod_price .price_normal s').first().text().replace(/[^0-9]/g, ''))
                     || parseInt(item.find('.prod_price .price_normal .val').first().text().replace(/[^0-9]/g, ''))
                     || price

  if (!price) return null
  return { platform: '교보문고', price, originalPrice, link }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────
// 가격 조회할 때마다 예스24/교보문고를 다시 스크래핑하면 상대 사이트에 불필요한
// 부하를 준다. 가격은 짧은 시간 내에는 거의 바뀌지 않으므로 캐싱해서 요청을 줄인다.
const priceCache = new Map()
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000 // 10분

export async function getPrices(isbn, title = '') {
  const cacheKey = `${isbn}:${title}`
  const cached = priceCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL_MS) return cached.data

  const result = await fetchPrices(isbn, title)
  priceCache.set(cacheKey, { data: result, timestamp: Date.now() })
  return result
}

async function fetchPrices(isbn, title) {
  if (process.env.USE_MOCK !== 'false') {
    await delay(500)
    const mock = [
      { platform: '네이버',   price: 13860, originalPrice: 15400, link: `https://search.shopping.naver.com/book/catalog/${isbn}` },
      { platform: '예스24',   price: 13860, originalPrice: 15400, link: `https://www.yes24.com/Product/Search?query=${encodeURIComponent(title)}` },
      { platform: '알라딘',   price: 13860, originalPrice: 15400, link: `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${isbn}` },
      { platform: '교보문고', price: 14000, originalPrice: 15400, link: `https://product.kyobobook.co.kr/detail/${isbn}` },
    ]
    const min = Math.min(...mock.map(p => p.price))
    return mock.map(p => ({ ...p, isLowest: p.price === min }))
  }

  const [naver, aladin, yes24, kyobo] = await Promise.allSettled([
    scrapeNaver(isbn),
    scrapeAladin(isbn),
    scrapeYes24(title),
    scrapeKyobo(isbn, title),
  ])

  const prices = [naver, aladin, yes24, kyobo]
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(p => p && p.price > 0)

  if (!prices.length) return []

  const min = Math.min(...prices.map(p => p.price))
  return prices.map(p => ({ ...p, isLowest: p.price === min }))
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

// 괄호/부제/리커버 표기 제거한 핵심 제목만 추출
function baseTitle(str) {
  return (str || '')
    .replace(/\s*[(\[:].*/, '')  // 첫 괄호/콜론 이후 제거
    .trim()
}

function normalizeStr(str) {
  return (str || '').replace(/[\s\[\]()《》<>「」『』:：]/g, '').toLowerCase()
}

function similarity(a, b) {
  const na = normalizeStr(a)
  const nb = normalizeStr(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  // 길이 비율 고려: 짧은 문자열이 긴 문자열의 부분 문자열이어도 길이 차이가 크면 낮은 점수
  const lengthRatio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
  if (na.includes(nb) || nb.includes(na)) return 0.9 * lengthRatio
  const common = [...na].filter(c => nb.includes(c)).length
  return (common / Math.max(na.length, nb.length)) * Math.sqrt(lengthRatio)
}
