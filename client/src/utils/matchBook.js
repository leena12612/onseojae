const normalize = (str) => (str || '').replace(/\s/g, '')

// 순위/차트 API가 ISBN을 안 주는 항목을 제목으로 재검색해서 연결할 때 쓰는 매칭 로직.
// 제목만 보고 부분 문자열이 겹친다고 매칭하면 전혀 다른 책(예: "불안" 검색 시 "불안 세대")이
// 잘못 걸릴 수 있어서, 저자 정보가 있으면 저자도 겹쳐야만 후보로 인정한다.
export function findMatchingBook(results, title, author) {
  const qNorm = normalize(title)
  const authorNorm = normalize(author)

  const candidates = results.filter((b) => {
    if (!b.isbn) return false
    const titleNorm = normalize(b.title)
    const titleOk = titleNorm === qNorm || titleNorm.includes(qNorm) || qNorm.includes(titleNorm)
    if (!titleOk) return false
    if (!authorNorm) return true
    const bAuthorNorm = normalize(b.author)
    return bAuthorNorm.includes(authorNorm) || authorNorm.includes(bAuthorNorm)
  })

  return candidates.find((b) => normalize(b.title) === qNorm) || candidates[0] || null
}
