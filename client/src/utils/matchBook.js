const normalize = (str) => (str || '').replace(/\s/g, '')

// "위화 지음/ 백원담 옮김"처럼 역할 표기가 붙은 저자 문자열에서 대표 저자 이름만 뽑아낸다.
// (검색어에 그대로 넣으면 "지음", "옮김" 같은 토큰 때문에 검색 결과가 0건이 되는 문제 방지)
export function cleanAuthor(author) {
  if (!author) return ''
  return author
    .split(/[/,^]/)[0]
    .replace(/\s*(지음|옮김|엮음|그림|저)\s*$/, '')
    .trim()
}

// "조지오웰 지음 / 도정일 옮김"처럼 저자와 역자가 함께 표기된 문자열에서 각 이름을 모두 뽑아낸다.
// cleanAuthor는 검색어용으로 저자 이름 하나만 남기지만, 고전처럼 번역본이 많은 책은 역자까지
// 같이 확인해야 다른 번역본과 헷갈리지 않는다.
function extractNames(author) {
  if (!author) return []
  return author
    .split(/[/,^]/)
    .map((part) => part.replace(/\s*(지음|옮김|엮음|그림|저)\s*$/, '').trim())
    .filter(Boolean)
}

// 순위/차트 API가 ISBN을 안 주는 항목을 제목으로 재검색해서 연결할 때 쓰는 매칭 로직.
// 제목만 보고 부분 문자열이 겹친다고 매칭하면 전혀 다른 책(예: "불안" 검색 시 "불안 세대")이
// 잘못 걸릴 수 있어서, 저자 정보가 있으면 저자도 겹쳐야만 후보로 인정한다.
// 저자 이름만 확인하면 고전처럼 번역본이 많은 책에서 역자가 다른 엉뚱한 판본이 걸릴 수 있어서,
// 원문에 역자 표기가 있으면 역자 이름까지 전부 일치해야 후보로 인정한다.
export function findMatchingBook(results, title, author) {
  const qNorm = normalize(title)
  const names = extractNames(author).map(normalize)

  const candidates = results.filter((b) => {
    if (!b.isbn) return false
    const titleNorm = normalize(b.title)
    const titleOk = titleNorm === qNorm || titleNorm.includes(qNorm) || qNorm.includes(titleNorm)
    if (!titleOk) return false
    if (names.length === 0) return true
    const bAuthorNorm = normalize(b.author)
    return names.every((n) => bAuthorNorm.includes(n))
  })

  return candidates.find((b) => normalize(b.title) === qNorm) || candidates[0] || null
}
