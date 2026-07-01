/**
 * 교보 전자도서관 / Yes24 전자도서관 이용기관 목록 자동 수집 스크립트
 *
 * 사용법:
 *   node server/scripts/scrapeLibraryList.mjs            ← 전체 새로 생성
 *   node server/scripts/scrapeLibraryList.mjs --append   ← 기존 유지, 새 항목만 추가
 *   node server/scripts/scrapeLibraryList.mjs --dry-run  ← 파일 저장 없이 콘솔 출력만
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT    = path.resolve(__dirname, '../data/libraries.json')
const UA        = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
const CONCURRENCY = 8

// ─── 지역 추론 ────────────────────────────────────────────────────────────────

const REGION_RULES = [
  ['서울', ['강남', '강동', '강북', '강서', '관악', '광진', '구로', '금천', '노원', '도봉', '동대문', '동작', '마포', '서대문', '서초', '성동', '성북', '송파', '용산', '은평', '종로', '중랑', '서울']],
  ['경기', ['경기', '수원', '성남', '안양', '부천', '고양', '의정부', '안산', '광명', '평택', '시흥', '군포', '의왕', '하남', '오산', '이천', '안성', '김포', '여주', '화성', '파주', '양주', '구리', '남양주', '가평', '양평', '연천', '포천', '동두천', '용인', '과천']],
  ['인천', ['인천', '부평', '계양', '남동', '연수', '미추홀']],
  ['부산', ['부산', '해운대', '동래', '사하', '금정']],
  ['대구', ['대구', '달서', '수성', '달성']],
  ['광주', ['광주광역']],
  ['대전', ['대전', '대덕구']],
  ['울산', ['울산']],
  ['세종', ['세종']],
  ['강원', ['강원', '춘천', '원주', '강릉', '동해', '태백', '속초', '삼척']],
  ['충북', ['충북', '청주', '충주', '제천', '단양']],
  ['충남', ['충남', '천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진']],
  ['전북', ['전북', '전주', '군산', '익산', '정읍', '남원', '김제', '고창', '부안', '무주']],
  ['전남', ['전남', '목포', '여수', '순천', '나주', '광양', '강진', '고흥']],
  ['경북', ['경북', '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '경산']],
  ['경남', ['경남', '창원', '마산', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '남해']],
  ['제주', ['제주', '서귀포']],
]

function inferRegion(name) {
  for (const [region, keywords] of REGION_RULES) {
    for (const kw of keywords) {
      if (name.includes(kw)) return region
    }
  }
  return '기타'
}

// ─── 플랫폼 감지 ──────────────────────────────────────────────────────────────

async function detectPlatform(baseUrl) {
  const probes = [
    // kyobo_t3: /Kyobo_T3/... 경로 응답 여부 확인
    { path: '/Kyobo_T3/Content/Content_Search.asp', platform: 'kyobo_t3' },
    // kyobo: /elibrary-front/... 경로 응답 여부 확인
    { path: '/elibrary-front/search/searchList.ink', platform: 'kyobo' },
    // yes24: /search/ 경로 응답 여부 확인
    { path: '/search/', platform: 'yes24' },
  ]

  for (const { path: urlPath, platform } of probes) {
    try {
      const res = await axios.get(`${baseUrl}${urlPath}`, {
        headers: { 'User-Agent': UA },
        timeout: 6000,
        validateStatus: s => s < 500,
        maxRedirects: 3,
      })
      if (res.status < 400) return platform
    } catch {
      // 연결 실패 → 다음 probe 시도
    }
  }
  return 'kyobo' // 기본값
}

// ─── 교보 전자도서관 공공도서관 목록 스크래핑 ─────────────────────────────────

const SKIP_DOMAINS = [
  'kyobobook.co.kr', 'google.', 'youtube.', 'facebook.', 'instagram.',
  'apple.com', 'naver.com', 'daum.net',
]

async function scrapeKyoboPublicLibraries() {
  const { data } = await axios.get('https://ebook.kyobobook.co.kr/dig/cff/e-library', {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  })
  const $ = cheerio.load(data)

  const libraries = []
  const seen = new Set()

  // 1순위: "공공도서관" 텍스트를 포함하는 탭 콘텐츠 영역
  //        탭 버튼 옆 콘텐츠 패널 안의 링크만 추출
  let $scope = null
  $('[class*="tab"], [id*="tab"], [class*="panel"], [id*="panel"]').each((_, el) => {
    if ($(el).text().includes('공공도서관') && $(el).find('a[href^="http"]').length > 10) {
      $scope = $(el)
      return false // each 중단
    }
  })

  // 2순위: 전체 페이지에서 외부 링크 수집 (탭 구분 실패 시)
  const $target = $scope || $.root()

  $target.find('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    const name = $(el).text().trim()
    if (!href.startsWith('http') || !name) return
    if (SKIP_DOMAINS.some(d => href.includes(d))) return
    if (seen.has(href)) return
    seen.add(href)
    libraries.push({ name, baseUrl: href.replace(/\/+$/, '') })
  })

  return libraries
}

// ─── Yes24 전자도서관 이용기관 목록 스크래핑 ──────────────────────────────────
// Yes24는 중앙 목록 페이지가 없어 현재 수동 관리가 필요함
// 추후 yes24library.com에서 select 드롭다운 등 발견 시 여기에 구현

async function scrapeYes24Libraries() {
  return []
}

// ─── 병렬 처리 ───────────────────────────────────────────────────────────────

async function runBatched(items, fn, concurrency) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    results.push(...await Promise.all(batch.map((item, j) => fn(item, i + j))))
  }
  return results
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  const appendMode = process.argv.includes('--append')
  const dryRun     = process.argv.includes('--dry-run')

  // 기존 데이터 로드
  let existing = []
  let existingUrls = new Set()
  try {
    existing = JSON.parse(await fs.readFile(OUTPUT, 'utf-8'))
    existingUrls = new Set(existing.map(l => l.baseUrl))
  } catch {}

  // 목록 수집
  console.log('📚 교보 공공도서관 목록 수집 중...')
  const kyoboRaw  = await scrapeKyoboPublicLibraries()
  const yes24Raw  = await scrapeYes24Libraries()
  const allRaw    = [...kyoboRaw, ...yes24Raw]
  console.log(`✅ ${allRaw.length}개 도서관 발견 (교보: ${kyoboRaw.length}, Yes24: ${yes24Raw.length})`)

  // append 모드: 이미 등록된 URL 제외
  const toProcess = appendMode
    ? allRaw.filter(l => !existingUrls.has(l.baseUrl))
    : allRaw
  console.log(`🔍 플랫폼 감지 대상: ${toProcess.length}개 (동시 ${CONCURRENCY}개)\n`)

  // 플랫폼 감지 + 지역 추론
  const processed = await runBatched(toProcess, async (lib, i) => {
    const platform = await detectPlatform(lib.baseUrl)
    const region   = inferRegion(lib.name)
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${toProcess.length}] ${lib.name.padEnd(25)} → ${platform} (${region})\n`)
    return { name: lib.name, region, platform, baseUrl: lib.baseUrl, link: lib.baseUrl }
  }, CONCURRENCY)

  // 최종 목록 조합 및 id 재정렬
  const merged = appendMode ? [...existing, ...processed] : processed
  const final  = merged.map((lib, i) => ({ id: `lib-${i + 1}`, ...lib }))

  if (dryRun) {
    console.log('\n--- DRY RUN 결과 (저장 안 함) ---')
    console.log(JSON.stringify(final.slice(0, 5), null, 2))
    console.log(`  ...총 ${final.length}개`)
    return
  }

  await fs.writeFile(OUTPUT, JSON.stringify(final, null, 2), 'utf-8')
  console.log(`\n✅ 완료! 총 ${final.length}개 → ${OUTPUT}`)
  console.log('   tip: --append 옵션으로 기존 데이터를 보존하며 추가할 수 있습니다.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
