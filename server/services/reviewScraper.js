import axios from 'axios'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'
import Anthropic from '@anthropic-ai/sdk'

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
  const m   = tmp.match(/charset=['""]?([a-zA-Z0-9\-]+)/i)
  return iconv.decode(buf, m ? m[1] : 'utf-8')
}

// ─── 알라딘 (TTB API 별점 + GetCommunityListAjax 100자평) ────────────────────
async function getAladinReviews(isbn) {
  const ttbKey = process.env.ALADIN_TTB_KEY
  if (!ttbKey) return null

  const { data } = await axios.get('http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx', {
    params: { ttbkey: ttbKey, itemIdType: 'ISBN13', ItemId: isbn, output: 'js', Version: '20131101' },
    timeout: 8000,
  })

  const item = data.item?.[0]
  if (!item) return null

  // 알라딘 별점: 0~10 → 0~5 환산
  const rating = item.customerReviewRank ? (item.customerReviewRank / 2).toFixed(1) : null
  const itemLink = item.link || `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${isbn}`

  // item.link 에서 ItemId 추출 → 100자평 API 호출에 사용
  const itemId = itemLink.match(/ItemId=(\d+)/i)?.[1]

  const reviews = []
  if (itemId) {
    try {
      const res = await axios.get(
        'https://www.aladin.co.kr/ucl/shop/product/ajax/GetCommunityListAjax.aspx',
        {
          params: {
            ProductItemId: itemId,
            itemId,
            pageCount: 5,
            communitytype: 'CommentReview',
            nemoType: -1,
            page: 1,
            startNumber: 1,
            endNumber: 5,
            sort: 2,
            IsOrderer: 2,
            BranchType: 1,
            IsAjax: true,
            pageType: 0,
          },
          headers: {
            'User-Agent': UA,
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${itemId}`,
          },
          timeout: 10000,
          responseType: 'arraybuffer',
        },
      )

      const buf = Buffer.from(res.data)
      const html = buf.toString('utf-8')
      const $ = cheerio.load(html)

      $('.hundred_list').each((_, el) => {
        const $el = $(el)

        // 별점: icon_star_on 이미지 수 = 별점
        const starCount = $el.find('img[src*="icon_star_on"]').length
        const ratingVal = starCount > 0 ? starCount : null

        // 리뷰 본문 (스포일러 숨김 span 제외)
        const content = $el
          .find('span[id^="spnPaper"]')
          .filter((_, s) => !$(s).attr('style')?.includes('none'))
          .text()
          .trim()

        // 작성자 (* 마스킹)
        const rawAuthor = $el.find('div.left a.Ere_sub_gray8').first().text().trim()
        const author = maskId(rawAuthor)

        // 날짜
        let date = ''
        $el.find('div.left span.Ere_sub_gray8').each((_, s) => {
          const t = $(s).text().trim()
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) date = t
        })

        if (content) reviews.push({ title: '', content, author, date, rating: ratingVal })
      })
    } catch (_) {}
  }

  const productLink = itemId
    ? `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${itemId}#infoset_commentReview`
    : itemLink

  return {
    platform:    '알라딘',
    rating:      rating ? parseFloat(rating) : null,
    reviewCount: null,
    reviews,
    link:        productLink,
    note:        reviews.length === 0 ? '알라딘 리뷰는 사이트에서 확인하세요' : undefined,
  }
}

// ─── 예스24 (리뷰 + AI 요약) ──────────────────────────────────────────────────
async function getYes24Reviews(title, yes24Link) {
  if (!yes24Link) return null

  // 상품번호 추출: /Product/Goods/101375755 → 101375755
  const goodsNo = yes24Link.match(/\/goods\/(\d+)/i)?.[1]
  if (!goodsNo) return null

  // AI 요약은 상품 페이지에서 파싱
  let aiSummary = null
  try {
    const productHtml = await fetchHtml(
      `https://www.yes24.com/Product/Goods/${goodsNo}`,
      {},
      { Referer: 'https://www.yes24.com' },
    )
    const $p = cheerio.load(productHtml)
    const summaryText = $p('#typingTarget').attr('data-text')?.trim()
    if (summaryText) aiSummary = summaryText
  } catch (_) {}

  // 개별 리뷰 목록
  const html = await fetchHtml(
    `https://www.yes24.com/Product/communityModules/GoodsReviewList/${goodsNo}`,
    { pageNumber: 1, pageSize: 5, sortType: 'recommend' },
    { Referer: `https://www.yes24.com/Product/Goods/${goodsNo}` },
  )

  const $ = cheerio.load(html)
  const reviews = []

  $('.reviewInfoGrp').each((_, el) => {
    const $el      = $(el)
    const titleTxt = $el.find('.review_tit .txt').text().trim()
    const content  = $el.find('.review_cont').text().trim()
    const author   = $el.find('.txt_id').text().trim()
    const date     = $el.find('.txt_date').text().trim()

    // 별점: class="total_rating total_rating_10" → 10점 → 5점 환산
    const ratingClass = $el.find('.total_rating').attr('class') || ''
    const ratingMatch = ratingClass.match(/total_rating_(\d+)/)
    const rating      = ratingMatch ? parseInt(ratingMatch[1]) / 2 : null

    if (content || titleTxt) {
      reviews.push({ title: titleTxt, content, author, date, rating })
    }
  })

  if (!reviews.length && !aiSummary) return null

  const avgRating = reviews.filter(r => r.rating).reduce((s, r) => s + r.rating, 0)
                  / (reviews.filter(r => r.rating).length || 1)

  return {
    platform:   '예스24',
    rating:     reviews.length ? parseFloat(avgRating.toFixed(1)) : null,
    reviews,
    aiSummary,
    link: `https://www.yes24.com/Product/Goods/${goodsNo}#infoset_review`,
  }
}

// ─── 교보문고 (내부 API 크롤링) ───────────────────────────────────────────────
async function getKyoboReviews(isbn, kyoboLink) {
  if (!kyoboLink) return null

  // kyoboLink: https://product.kyobobook.co.kr/detail/S000210530586
  const pid = kyoboLink.match(/\/detail\/(S\d+)/)?.[1]
  if (!pid) return null

  const link = kyoboLink

  const browserHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': kyoboLink,
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  }

  // 1) 상품 페이지 HTML → 전체 평점 + AI 요약
  let overallRating = null
  let totalCount    = null
  let aiSummary     = null
  try {
    const html = await fetchHtml(kyoboLink, {}, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
    })
    const $ = cheerio.load(html)
    const ratingTxt = $('.prod_review_box .review_score').text().trim()
    if (ratingTxt) overallRating = parseFloat(ratingTxt) / 2  // 10점 → 5점
    const countTxt  = $('.review_desc .val').first().text().trim()
    if (countTxt)  totalCount    = parseInt(countTxt.replace(/[^0-9]/g, '')) || null

    // AI 요약 API
    const { data: summRes } = await axios.get(
      `https://product.kyobobook.co.kr/api/gw/pdt/review/summary?saleCmdtid=${pid}`,
      { headers: { ...browserHeaders, Accept: 'application/json' }, timeout: 6000 },
    )
    const sd = summRes?.data
    if (sd) {
      const lead   = (sd.summ_oli_cntt || '').trim()
      const detail = (sd.summ_revw_cntt || '').trim()
      const tags   = (sd.summ_revw_kywr_cntt || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '#' + t)
      aiSummary = [lead, detail].filter(Boolean).join('\n') + (tags.length ? '\n' + tags.join(' ') : '')
    }
  } catch (_) {}

  // 2) 개별 리뷰 (내부 API — revwPatrCode=000: PC+모바일 전체)
  const reviews = []
  try {
    const { data: res } = await axios.get(
      'https://product.kyobobook.co.kr/api/gw/pdt/review/list',
      {
        headers: browserHeaders,
        params: { saleCmdtids: pid, page: 1, pageLimit: 5, reviewSort: 'RECOMMEND', revwPatrCode: '000' },
        timeout: 10000,
      },
    )

    const list = res?.data?.reviewList || []
    if (!totalCount) totalCount = res?.data?.totalCount || null

    list.forEach(r => {
      const content = (r.revwCntt || '').trim()
      if (!content) return
      reviews.push({
        title:   r.revwEmtnKywrName || '',   // 감정 키워드 (최고예요, 추천해요 등)
        content,
        author:  r.mmbrId || '',
        date:    (r.cretDttm || '').slice(0, 10),
        rating:  null,                        // 교보는 별점 대신 감정 키워드 사용 → 별 미표시
      })
    })
  } catch (_) {}

  if (!reviews.length && !overallRating) return null

  return {
    platform:    '교보문고',
    rating:      overallRating,
    reviewCount: totalCount,
    reviews,
    aiSummary,
    link,
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────
// 리뷰 스크래핑 + Claude 요약 생성은 몇 초씩 걸리고 리뷰 내용은 자주 바뀌지 않으므로
// ISBN 단위로 결과를 캐싱해서, 같은 책을 다시 조회할 때는 즉시 응답한다.
const reviewCache = new Map()
const REVIEW_CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12시간
const EMPTY_REVIEW_CACHE_TTL_MS = 60 * 1000 // 1분 — 스크래핑 실패/빈 결과는 짧게만 캐싱해서 금방 재시도되게 함

export async function getReviews(isbn, options = {}) {
  const cached = reviewCache.get(isbn)
  if (cached) {
    const ttl = cached.data.length ? REVIEW_CACHE_TTL_MS : EMPTY_REVIEW_CACHE_TTL_MS
    if (Date.now() - cached.timestamp < ttl) return cached.data
  }

  const result = await fetchReviews(isbn, options)
  reviewCache.set(isbn, { data: result, timestamp: Date.now() })
  return result
}

async function fetchReviews(isbn, { title = '', yes24Link = '', kyoboLink = '' } = {}) {
  if (process.env.USE_MOCK !== 'false') {
    await delay(400)
    return [
      {
        platform: '예스24', rating: 4.8, reviewCount: 10,
        link: `https://www.yes24.com/Product/Search?query=${encodeURIComponent(title)}`,
        reviews: [
          { title: '정말 재밌어요', content: '오랜만에 빠져서 읽은 책이에요. 강력 추천합니다!', author: 'r****l', date: '2024-01-15', rating: 5 },
          { title: '최고의 SF', content: '우주 과학 지식도 얻고 감동도 받았습니다.', author: 'k****m', date: '2024-01-10', rating: 5 },
        ],
      },
      {
        platform: '알라딘', rating: 4.85, reviewCount: null,
        link: `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${isbn}`,
        reviews: [
          { title: '', content: '정말 좋은 책입니다. 강력 추천해요!', author: '독서광', date: '2024-03-10', rating: 5 },
          { title: '', content: '읽는 내내 감동받았습니다. 오래 기억에 남을 것 같아요.', author: '북러버', date: '2024-02-15', rating: 5 },
        ],
      },
      { platform: '교보문고', rating: null, reviewCount: null, reviews: [], link: `https://product.kyobobook.co.kr/detail/${isbn}`, note: '교보문고 리뷰는 사이트에서 확인하세요' },
    ]
  }

  const [aladin, yes24, kyobo] = await Promise.allSettled([
    getAladinReviews(isbn),
    getYes24Reviews(title, yes24Link),
    getKyoboReviews(isbn, kyoboLink),
  ])

  const results = [aladin, yes24, kyobo]
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean)

  // Claude 종합 요약 생성
  const claudeSummary = await generateClaudeSummary(title, results)
  if (claudeSummary) {
    results.unshift({ platform: 'Claude', aiSummary: claudeSummary, reviews: [] })
  }

  return results
}

// ─── Claude 종합 리뷰 요약 ─────────────────────────────────────────────────────
async function generateClaudeSummary(title, platformReviews) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // 리뷰 텍스트 수집
  const sections = platformReviews
    .filter(p => p.reviews?.length > 0)
    .map(p => {
      const lines = p.reviews.map(r => `- ${r.content}`).join('\n')
      return `[${p.platform}]\n${lines}`
    })

  if (sections.length === 0) return null

  const prompt = `다음은 "${title}"에 대한 독자 리뷰입니다.\n\n${sections.join('\n\n')}\n\n위 리뷰들을 바탕으로 2~3문장으로 핵심을 요약해주세요. 긍정적/부정적 의견을 균형있게 반영하고, 마지막 줄에 주요 키워드를 #태그 형식으로 3~5개 작성해주세요. 한국어로 작성해주세요.`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    return message.content[0]?.text?.trim() || null
  } catch (_) {
    return null
  }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// 아이디 마스킹: 첫 글자 + *** + 마지막 글자
function maskId(id) {
  if (!id) return ''
  if (id.length <= 2) return id[0] + '*'.repeat(id.length - 1)
  return id[0] + '*'.repeat(id.length - 2) + id[id.length - 1]
}
