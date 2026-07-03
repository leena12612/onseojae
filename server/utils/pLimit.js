/**
 * 동시 실행 개수를 제한하는 간단한 세마포어.
 * pLimit(20) → limit(fn) 형태로 호출하면 최대 20개까지만 동시에 fn을 실행한다.
 */
export function pLimit(concurrency) {
  const queue = []
  let activeCount = 0

  const runNext = () => {
    activeCount--
    if (queue.length > 0) queue.shift()()
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        activeCount++
        fn().then(resolve, reject).finally(runNext)
      }
      if (activeCount < concurrency) run()
      else queue.push(run)
    })
  }
}
