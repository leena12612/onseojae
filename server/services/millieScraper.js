import axios from 'axios'

const API = 'https://apis.millie.co.kr'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.millie.co.kr/',
  'Origin': 'https://www.millie.co.kr',
}

export const PERIODS = [
  { id: 'day',   label: '일간' },
  { id: 'week',  label: '주간' },
  { id: 'month', label: '월간' },
  { id: 'year',  label: '연간' },
]

export const MILLIE_CATEGORIES = [
  { id: 'total',            label: '종합' },
  { id: 'story',            label: '소설' },
  { id: 'economy',          label: '경제/경영' },
  { id: 'self-development', label: '자기계발' },
  { id: 'poem',             label: '에세이/시' },
  { id: 'humanities',       label: '인문/교양' },
  { id: 'hobby',            label: '취미/실용' },
  { id: 'child',            label: '어린이/청소년' },
  { id: 'magazine',         label: '매거진' },
]

export const CONTENT_TYPES = [
  { id: '',           label: '전체' },
  { id: 'ebook',      label: '전자책' },
  { id: 'audio_book', label: '오디오북' },
  { id: 'chat_book',  label: '챗북' },
]

export const AGE_OPTIONS = [
  { id: '',   label: '전체' },
  { id: '10', label: '10대' },
  { id: '20', label: '20대' },
  { id: '30', label: '30대' },
  { id: '40', label: '40대' },
  { id: '50', label: '50대' },
  { id: '60', label: '60대 이상' },
]

export const GENDER_OPTIONS = [
  { id: '',       label: '전체' },
  { id: 'female', label: '여성' },
  { id: 'male',   label: '남성' },
]

export const BOOKSTORE_CATEGORIES = [
  { id: 'total',            label: '종합' },
  { id: 'story',            label: '소설' },
  { id: 'economy',          label: '경제/경영' },
  { id: 'self-development', label: '자기계발' },
  { id: 'poem',             label: '에세이/시' },
  { id: 'humanities',       label: '인문/교양' },
  { id: 'hobby',            label: '취미/실용' },
  { id: 'child',            label: '어린이/청소년' },
  { id: 'magazine',         label: '매거진' },
]

function mapBook(b, i) {
  const rankChange = b.daily_rank_history ?? b.weekly_rank_history
  return {
    rank:        b.library_take_count_1_rank ?? i + 1,
    title:       b.book_name ?? '',
    author:      b.author ?? '',
    coverUrl:    b.cover_image_url ?? '',
    category:    (b.category_name ?? '').trim(),
    isAudiobook: b.badge?.is_audiobook ?? false,
    loanCount:   b.library_take_count_all ?? 0,
    rankChange:  rankChange === 'new' ? 'new' : (parseInt(rankChange) || 0),
  }
}

export async function getMillieBestsellers({ period = 'day', category = 'total', contentType = '', age = '', gender = '' } = {}) {
  const params = { adult: 0, offset: 0, size: 100, range: period, category, book_type_code: '01' }
  if (contentType) params.content_type = contentType
  if (age)         params.age          = age
  if (gender)      params.gender       = gender

  const { data } = await axios.get(`${API}/v3/rank/millie/`, { params, headers: HEADERS, timeout: 10000 })
  return (data?.data || []).map(mapBook)
}

export async function getMillieBookstoreBestsellers({ year, month, category = 'total' } = {}) {
  const now = new Date()
  const { data } = await axios.get(`${API}/v3/rank/bookstore/`, {
    params: { size: 100, category, year: year ?? now.getFullYear(), month: month ?? now.getMonth() + 1 },
    headers: HEADERS,
    timeout: 10000,
  })
  return (data?.data || []).map((b, i) => ({ ...mapBook(b, i), rank: i + 1 }))
}
