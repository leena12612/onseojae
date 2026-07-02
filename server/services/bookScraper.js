import axios from 'axios'

// ─── 네이버 도서 검색 API ──────────────────────────────────────────────────────

function naverHeaders() {
  return {
    'X-Naver-Client-Id':     process.env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    'Referer': process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  }
}

const PAGE_SIZE = 10

export async function searchBooks(query, { page = 1, sort = 'sim' } = {}) {
  if (process.env.USE_MOCK !== 'false') {
    await delay(300)
    return { books: MOCK_SEARCH, totalCount: MOCK_SEARCH.length, mergedCount: 2, page: 1, pageSize: PAGE_SIZE }
  }

  const start = (page - 1) * PAGE_SIZE + 1
  const { data } = await axios.get('https://openapi.naver.com/v1/search/book.json', {
    params: { query, display: PAGE_SIZE, start, sort },
    headers: naverHeaders(),
    timeout: 6000,
  })

  const books = (data.items || []).map(mapNaverItem)
  const isbns = books.map(b => b.isbn).filter(Boolean)
  const mergedCount = isbns.length - new Set(isbns).size

  return { books, totalCount: data.total || books.length, mergedCount, page, pageSize: PAGE_SIZE }
}

export async function getBookByISBN(isbn) {
  if (process.env.USE_MOCK !== 'false') {
    await delay(200)
    return MOCK_DETAIL[isbn] ?? null
  }

  const { data } = await axios.get('https://openapi.naver.com/v1/search/book_adv.json', {
    params: { d_isbn: isbn },
    headers: naverHeaders(),
    timeout: 6000,
  })

  const item = data.items?.[0]
  if (!item) return null

  const price = parseInt(item.discount) || parseInt(item.price) || 0
  const originalPrice = parseInt(item.price) || 0

  return {
    isbn,
    title:       stripHtml(item.title),
    author:      stripHtml(item.author),
    publisher:   stripHtml(item.publisher),
    publishedAt: formatPubdate(item.pubdate),
    coverUrl:    item.image,
    description: stripHtml(item.description),
    lowestPrice: price,
    libraryCount: 0,
    subscriptions: [],
    prices: [
      {
        platform:      '네이버',
        price,
        originalPrice,
        isLowest:      true,
        link:          item.link,
      },
    ],
    subscriptionDetails: [],
  }
}

// ─── 변환 헬퍼 ─────────────────────────────────────────────────────────────────

function mapNaverItem(item) {
  const price         = parseInt(item.discount) || parseInt(item.price) || 0
  const originalPrice = parseInt(item.price) || 0
  const discountRate  = originalPrice && price < originalPrice
    ? Math.round((1 - price / originalPrice) * 100)
    : null

  // 네이버는 "ISBN10 ISBN13" 형태로 반환 — ISBN13만 추출
  const isbn = (item.isbn || '').split(' ').find(s => s.length === 13) || item.isbn || ''

  return {
    isbn,
    title:         stripHtml(item.title),
    author:        stripHtml(item.author),
    publisher:     stripHtml(item.publisher),
    publishedAt:   formatPubdate(item.pubdate),
    platform:      'naver',
    platformLabel: '네이버',
    price,
    originalPrice,
    discountRate,
    coverUrl:      item.image || '',
    description:   stripHtml(item.description),
  }
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '').trim()
}

function formatPubdate(pubdate) {
  // "20210501" → "2021-05"
  if (!pubdate || pubdate.length < 6) return ''
  return `${pubdate.slice(0, 4)}-${pubdate.slice(4, 6)}`
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// ─── 목 데이터 ─────────────────────────────────────────────────────────────────

const MOCK_SEARCH = [
  {
    isbn: '9788925575926', title: '프로젝트 헤일메리', author: '앤디 위어',
    publisher: '알에이치코리아(RHK)', publishedAt: '2021-05',
    platform: 'naver', platformLabel: '네이버',
    price: 13860, originalPrice: 15400, discountRate: 10,
    coverUrl: 'https://image.yes24.com/goods/102750583/XL',
  },
  {
    isbn: '9791190885997', title: '프로젝트 헤일메리 – 윌라 오디오북', author: '앤디 위어',
    publisher: '알에이치코리아', publishedAt: '2021-05',
    platform: 'naver', platformLabel: '네이버',
    price: 19800, originalPrice: 19800, discountRate: null, coverUrl: '',
  },
]

const MOCK_DETAIL = {
  '9788925575926': {
    isbn: '9788925575926', title: '프로젝트 헤일메리', author: '앤디 위어',
    publisher: '알에이치코리아(RHK)', publishedAt: '2021-05',
    coverUrl: 'https://image.yes24.com/goods/102750583/XL',
    lowestPrice: 13860, libraryCount: 7, subscriptions: ['crema', 'willa', 'millie'],
    description: '대비작 《마션》과 후속작 《아르테미스》가 잇달아 대성공을 거두며 뉴욕 타임스와 아마존 베스트셀러에 이름을 올린 명실상부 최고의 SF 작가, 앤디 위어의 신작.',
    prices: [
      { platform: '예스24',    price: 13860, originalPrice: 15400, isLowest: true, link: 'https://www.yes24.com/Product/Goods/102750583' },
      { platform: '알라딘',    price: 13860, originalPrice: 15400, isLowest: true, link: 'https://www.aladin.co.kr' },
      { platform: '교보문고',  price: 13860, originalPrice: 13860, isLowest: true, link: 'https://ebook.kyobobook.co.kr' },
    ],
    subscriptionDetails: [
      { name: '크레마클럽',  type: '전자책',   status: 'available',   link: 'https://www.cremaclub.co.kr' },
      { name: '윌라',       type: '오디오북', status: 'available',   link: 'https://www.willa.kr' },
      { name: '밀리의서재', type: '오디오북', status: 'available',   link: 'https://www.millie.co.kr' },
      { name: '만권당',     type: '전자책',   status: 'unavailable' },
      { name: '리디셀렉트', type: '전자책',   status: 'error' },
    ],
  },
}
