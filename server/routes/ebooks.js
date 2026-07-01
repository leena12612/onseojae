import { Router } from 'express'
import { getPopularEbooks, REGIONS, LIBRARY_PERIODS } from '../services/libraryEbookService.js'
import { getMillieBestsellers, getMillieBookstoreBestsellers, PERIODS, MILLIE_CATEGORIES, CONTENT_TYPES, AGE_OPTIONS, GENDER_OPTIONS, BOOKSTORE_CATEGORIES } from '../services/millieScraper.js'

const router = Router()

router.get('/popular', async (req, res) => {
  try {
    const { region = '', page = '1', size = '20', range = 'month' } = req.query
    const result = await getPopularEbooks({
      region,
      pageNo:   parseInt(page),
      pageSize: parseInt(size),
      range,
    })
    res.json({ ...result, regions: REGIONS, periods: LIBRARY_PERIODS })
  } catch (err) {
    console.error('[ebooks/popular]', err.message)
    res.status(500).json({ error: 'Failed to fetch ebooks' })
  }
})

router.get('/millie', async (req, res) => {
  try {
    const { period = 'day', category = 'total', contentType = '', age = '', gender = '' } = req.query
    const books = await getMillieBestsellers({ period, category, contentType, age, gender })
    res.json({ books, periods: PERIODS, categories: MILLIE_CATEGORIES, contentTypes: CONTENT_TYPES, ageOptions: AGE_OPTIONS, genderOptions: GENDER_OPTIONS })
  } catch (err) {
    console.error('[ebooks/millie]', err.message)
    res.status(500).json({ error: 'Failed to fetch millie' })
  }
})

router.get('/bookstore', async (req, res) => {
  try {
    const { year, month, category = 'total' } = req.query
    const books = await getMillieBookstoreBestsellers({
      year:     year  ? parseInt(year)  : undefined,
      month:    month ? parseInt(month) : undefined,
      category,
    })
    res.json({ books, categories: BOOKSTORE_CATEGORIES })
  } catch (err) {
    console.error('[ebooks/bookstore]', err.message)
    res.status(500).json({ error: 'Failed to fetch bookstore' })
  }
})

export default router
