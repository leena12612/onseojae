import axios from 'axios'

export const CATEGORIES = [
  { id: 0,      label: '종합' },
  { id: 1,      label: '소설/시' },
  { id: 170,    label: '경제경영' },
  { id: 336,    label: '자기계발' },
  { id: 656,    label: '인문' },
  { id: 55889,  label: '에세이' },
  { id: 51395,  label: '어린이' },
]

export async function getBestsellers({ categoryId = 0, maxResults = 50, queryType = 'Bestseller' } = {}) {
  const ttbKey = process.env.ALADIN_TTB_KEY
  if (!ttbKey) return []

  const { data } = await axios.get('http://www.aladin.co.kr/ttb/api/ItemList.aspx', {
    params: {
      ttbkey:       ttbKey,
      QueryType:    queryType,
      MaxResults:   maxResults,
      start:        1,
      SearchTarget: 'Book',
      CategoryId:   categoryId,
      Cover:        'Big',
      output:       'js',
      Version:      '20131101',
    },
    timeout: 8000,
  })

  const seen = new Set()
  const unique = (data.item || []).filter(item => {
    const isbn = item.isbn13 || item.isbn
    if (!isbn || seen.has(isbn)) return false
    if (item.categoryName?.includes('만화')) return false
    seen.add(isbn)
    return true
  })

  return unique.map((item, idx) => ({
    rank:      idx + 1,
    title:     item.title?.replace(/\s*-\s*.+$/, '').trim(),
    author:    item.author,
    publisher: item.publisher,
    coverUrl:  item.cover?.replace('coversum', 'cover500'),
    isbn:      item.isbn13 || item.isbn,
  }))
}
