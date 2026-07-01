import axios from 'axios'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// ─── 크레마클럽 (알라딘 전자책 구독) ─────────────────────────────────────────
async function checkCremaClub(isbn, title) {
  const ttbKey = process.env.ALADIN_TTB_KEY
  if (!ttbKey) return { status: 'unknown' }

  try {
    const { data } = await axios.get('http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx', {
      params: {
        ttbkey: ttbKey, itemIdType: 'ISBN13', ItemId: isbn,
        output: 'js', Version: '20131101', OptResult: 'ebookList',
      },
      timeout: 8000,
    })
    const ebookList = data.item?.[0]?.subInfo?.ebookList || []
    if (ebookList.length > 0) {
      return {
        status: 'available',
        link: `https://cremaclub.yes24.com/BookClub/Search?query=${encodeURIComponent(title || isbn)}`,
      }
    }
    return { status: 'unavailable' }
  } catch (_) {
    return { status: 'unknown' }
  }
}

// ─── 리디셀렉트 ───────────────────────────────────────────────────────────────
// 검색 HTML 페이지의 __NEXT_DATA__ JSON에서 셀렉트 여부 확인
async function checkRidiSelect(title, isbn) {
  const query = title || isbn
  if (!query) return { status: 'unknown' }

  const searchLink = `https://ridibooks.com/search?q=${encodeURIComponent(query)}`
  try {
    const { data: html } = await axios.get('https://ridibooks.com/search', {
      params: { q: query },
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      timeout: 10000,
    })

    const $ = cheerio.load(html)
    const raw = $('#__NEXT_DATA__').text()
    if (!raw) return { status: 'unknown', link: searchLink }

    const nextData = JSON.parse(raw)
    // books 배열 위치 탐색
    const books =
      nextData?.props?.pageProps?.searchResult?.books ||
      nextData?.props?.pageProps?.books ||
      nextData?.props?.pageProps?.data?.books ||
      []

    if (!books.length) return { status: 'unavailable' }

    const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase()
    const match = books.find(b => normalize(b.title) === normalize(title)) || books[0]
    if (!match) return { status: 'unavailable' }

    const prices = match.prices || match.price_infos || []
    const isSelect = !!(
      match.is_ridiselect ||
      match.is_select ||
      prices.some(p => (p.type || p.price_type || '').toLowerCase().includes('select'))
    )

    const bookLink = match.b_id
      ? `https://ridibooks.com/books/${match.b_id}`
      : searchLink

    return isSelect
      ? { status: 'available', link: bookLink }
      : { status: 'unavailable' }
  } catch (_) {
    return { status: 'unknown', link: searchLink }
  }
}

// ─── YES24 북클럽 ─────────────────────────────────────────────────────────────
async function checkYes24BookClub(title) {
  if (!title) return { status: 'unknown' }
  try {
    const res = await axios.get('https://www.yes24.com/Product/Search', {
      params: { domain: 'BSUB', query: title },
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' },
      timeout: 8000,
      responseType: 'arraybuffer',
    })
    const html = iconv.decode(Buffer.from(res.data), 'utf-8')
    const $ = cheerio.load(html)
    const firstTitle = $('ul.sGLi li').first().find('.gd_name').text().trim()
    const firstLink  = $('ul.sGLi li').first().find('.gd_name').attr('href') || ''

    const normalize = (s) => (s || '').replace(/\s*[(\[:].*/, '').replace(/\s+/g, '').toLowerCase()
    if (firstTitle && normalize(firstTitle) === normalize(title)) {
      const fullLink = firstLink.startsWith('http')
        ? firstLink
        : `https://www.yes24.com${firstLink}`
      return { status: 'available', link: fullLink }
    }
    return { status: 'unavailable' }
  } catch (_) {
    return { status: 'unknown' }
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────
export async function getSubscriptions(isbn, title = '') {
  const SERVICES = [
    { key: 'millie',   name: '밀리의서재', type: '전자책·오디오북' },
    { key: 'ridi',     name: '리디셀렉트', type: '전자책' },
    { key: 'crema',    name: '크레마클럽', type: '전자책' },
    { key: 'yes24sub', name: 'YES24 북클럽', type: '전자책·오디오북' },
    { key: 'willa',    name: '윌라',       type: '오디오북' },
    { key: 'kyobosam', name: '교보샘',     type: '전자책' },
  ]

  const SEARCH_LINKS = {
    millie:   `https://www.millie.co.kr/v3/search/result/${encodeURIComponent(title || isbn)}?type=total&contentcode=0&searchBack=y&nav_hidden=y&category=0`,
    willa:    `https://www.audioclip.naver.com/search?keyword=${encodeURIComponent(title || isbn)}`,
    kyobosam: `https://ebook.kyobobook.co.kr/dig/epd/ebook/search?query=${encodeURIComponent(title || isbn)}`,
  }

  const [crema, yes24sub, ridi] = await Promise.allSettled([
    checkCremaClub(isbn, title),
    checkYes24BookClub(title),
    checkRidiSelect(title, isbn),
  ])

  const cremaResult    = crema.status    === 'fulfilled' ? crema.value    : { status: 'unknown' }
  const yes24subResult = yes24sub.status === 'fulfilled' ? yes24sub.value : { status: 'unknown' }
  const ridiResult     = ridi.status     === 'fulfilled' ? ridi.value     : { status: 'unknown', link: `https://ridibooks.com/search?q=${encodeURIComponent(title || isbn)}` }

  return SERVICES.map(s => {
    switch (s.key) {
      case 'crema':    return { ...s, ...cremaResult }
      case 'yes24sub': return { ...s, ...yes24subResult }
      case 'ridi':     return { ...s, ...ridiResult }
      default:
        return { ...s, status: 'unknown', link: SEARCH_LINKS[s.key] }
    }
  })
}
