import { Router } from 'express'
import { getLibraryList, scrapeOne } from '../services/libraryScraper.js'
import { pLimit } from '../utils/pLimit.js'

const router = Router()
const CONCURRENCY = 40

/**
 * SSE 스트리밍
 * GET /api/libraries/:isbn/stream?title=...&author=...
 */
router.get('/:isbn/stream', async (req, res) => {
  const { isbn } = req.params
  const { title, author } = req.query

  if (!title) return res.status(400).json({ error: 'title query param required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const libraries = getLibraryList()
  send('count', { total: libraries.length })

  // 지역별로 묶어서 병렬 스크래핑
  const grouped = libraries.reduce((acc, lib) => {
    ;(acc[lib.region] = acc[lib.region] || []).push(lib)
    return acc
  }, {})

  let availableCount = 0
  const limit = pLimit(CONCURRENCY)

  await Promise.all(
    Object.entries(grouped).map(async ([region, libs]) => {
      const results = await Promise.allSettled(
        libs.map(lib => limit(() => scrapeOne(isbn, lib, { title, author })))
      )

      const regionLibraries = results.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { ...libs[i], status: 'error', errorMsg: r.reason?.message }
      )

      availableCount += regionLibraries.filter(l =>
        l.status === 'available' || l.status === 'unlimited' || l.status === 'found'
      ).length

      send('region', { region, libraries: regionLibraries })
    })
  )

  const total = libraries.length
  send('done', { availableCount, total })
  res.end()
})

/**
 * 배치 엔드포인트
 * GET /api/libraries/:isbn?title=...&author=...
 */
router.get('/:isbn', async (req, res) => {
  const { isbn } = req.params
  const { title, author } = req.query
  if (!title) return res.status(400).json({ error: 'title query param required' })

  try {
    const libraries = getLibraryList()
    const limit = pLimit(CONCURRENCY)
    const results = await Promise.allSettled(
      libraries.map(lib => limit(() => scrapeOne(isbn, lib, { title, author })))
    )

    const flat = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...libraries[i], status: 'error', errorMsg: r.reason?.message }
    )

    const grouped = flat.reduce((acc, lib) => {
      ;(acc[lib.region] = acc[lib.region] || []).push(lib)
      return acc
    }, {})

    res.json({
      grouped,
      availableCount: flat.filter(l => l.status === 'available' || l.status === 'unlimited' || l.status === 'found').length,
      total: flat.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
