import { Router } from 'express'
import { getBestsellers, CATEGORIES } from '../services/rankingScraper.js'

const router = Router()

// GET /api/rankings?categoryId=0
router.get('/', async (req, res) => {
  try {
    const { categoryId = '0', queryType = 'Bestseller' } = req.query
    const books = await getBestsellers({ categoryId: parseInt(categoryId), maxResults: 50, queryType })
    res.json({ books, categories: CATEGORIES })
  } catch (err) {
    console.error('[rankings]', err.message)
    res.status(500).json({ error: 'Failed to fetch rankings' })
  }
})

export default router
