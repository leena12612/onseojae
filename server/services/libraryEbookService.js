import axios from 'axios'

export const REGIONS = [
  { id: '',   label: '전체' },
  { id: '11', label: '서울' },
  { id: '31', label: '경기' },
  { id: '23', label: '인천' },
  { id: '32', label: '강원' },
  { id: '33', label: '충북' },
  { id: '34', label: '충남' },
  { id: '35', label: '전북' },
  { id: '36', label: '전남' },
  { id: '37', label: '경북' },
  { id: '38', label: '경남' },
  { id: '21', label: '부산' },
  { id: '22', label: '대구' },
  { id: '24', label: '광주' },
  { id: '25', label: '대전' },
  { id: '26', label: '울산' },
  { id: '29', label: '세종' },
  { id: '39', label: '제주' },
]

const RANGE_DAYS = { day: 1, week: 7, month: 30 }

function getDateRange(days = 30) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { startDt: fmt(start), endDt: fmt(end) }
}

export const LIBRARY_PERIODS = [
  { id: 'day',   label: '일간' },
  { id: 'week',  label: '주간' },
  { id: 'month', label: '월간' },
]

export async function getPopularEbooks({ region = '', pageNo = 1, pageSize = 20, range = 'month' } = {}) {
  const key = process.env.DATA4LIBRARY_API_KEY
  if (!key) return { books: [], totalCount: 0 }

  const days = RANGE_DAYS[range] ?? 30
  const { startDt, endDt } = getDateRange(days)

  const { data } = await axios.get('https://data4library.kr/api/loanItemSrch', {
    params: {
      authKey:  key,
      startDt,
      endDt,
      ...(region && { region }),
      pageNo,
      pageSize,
      format:   'json',
    },
    timeout: 10000,
  })

  const docs       = data.response?.docs || []
  const totalCount = parseInt(data.response?.numFound) || 0

  const books = docs.map((item, idx) => {
    const doc = item.doc || item
    return {
      rank:      (pageNo - 1) * pageSize + idx + 1,
      isbn:      doc.isbn13 || '',
      title:     doc.bookname || '',
      author:    doc.authors || '',
      publisher: doc.publisher || '',
      coverUrl:  doc.bookImageURL || '',
      loanCnt:   parseInt(doc.loanCnt) || 0,
    }
  })

  return { books, totalCount }
}
