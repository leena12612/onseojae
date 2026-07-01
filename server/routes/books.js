import { Router } from 'express'
import { searchBooks, getBookByISBN } from '../services/bookScraper.js'
import { getPrices } from '../services/priceScraper.js'
import { getReviews } from '../services/reviewScraper.js'
import { getSubscriptions } from '../services/subscriptionScraper.js'

const router = Router()

// GET /api/books/search?q=프로젝트+헤일메리&platform=all
router.get('/search', async (req, res) => {
  const { q, platform = 'all', page = '1', sort = 'sim' } = req.query
  if (!q?.trim()) return res.status(400).json({ error: 'q is required' })

  try {
    const result = await searchBooks(q.trim(), { page: parseInt(page), sort })
    res.json(result)
  } catch (err) {
    console.error('[books/search]', err.message)
    res.status(500).json({ error: 'Search failed' })
  }
})

// GET /api/books/:isbn/prices?title=책제목
router.get('/:isbn/prices', async (req, res) => {
  try {
    const { title = '' } = req.query
    const prices = await getPrices(req.params.isbn, title)
    res.json({ prices })
  } catch (err) {
    console.error('[books/:isbn/prices]', err.message)
    res.status(500).json({ error: 'Failed to fetch prices' })
  }
})

// GET /api/books/:isbn/subscriptions?title=...
router.get('/:isbn/subscriptions', async (req, res) => {
  try {
    const { title = '' } = req.query
    const subscriptions = await getSubscriptions(req.params.isbn, title)
    res.json({ subscriptions })
  } catch (err) {
    console.error('[books/:isbn/subscriptions]', err.message)
    res.status(500).json({ error: 'Failed to fetch subscriptions' })
  }
})

// GET /api/books/:isbn/reviews?title=...&yes24Link=...&kyoboLink=...
router.get('/:isbn/reviews', async (req, res) => {
  try {
    const { title = '', yes24Link = '', kyoboLink = '' } = req.query
    const reviews = await getReviews(req.params.isbn, { title, yes24Link, kyoboLink })
    res.json({ reviews })
  } catch (err) {
    console.error('[books/:isbn/reviews]', err.message)
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

// GET /api/books/:isbn/author-books?author=저자명
router.get('/:isbn/author-books', async (req, res) => {
  const { author = '' } = req.query
  if (!author.trim()) return res.json({ books: [] })
  const ttbKey = process.env.ALADIN_TTB_KEY
  if (!ttbKey) return res.json({ books: [] })
  try {
    const axios = (await import('axios')).default
    const { data } = await axios.get('http://www.aladin.co.kr/ttb/api/ItemSearch.aspx', {
      params: {
        ttbkey: ttbKey, Query: author.trim(), QueryType: 'Author',
        SearchTarget: 'Book', MaxResults: 10, Cover: 'Big',
        output: 'js', Version: '20131101',
      },
      timeout: 8000,
    })
    const books = (data.item || [])
      .filter(item => (item.isbn13 || item.isbn) !== req.params.isbn)
      .slice(0, 6)
      .map(item => ({
        isbn:     item.isbn13 || item.isbn,
        title:    item.title?.replace(/\s*-\s*.+$/, '').trim(),
        author:   item.author,
        coverUrl: item.cover?.replace('coversum', 'cover500'),
      }))
    res.json({ books })
  } catch (err) {
    console.error('[author-books]', err.message)
    res.json({ books: [] })
  }
})

// GET /api/books/:isbn
router.get('/:isbn', async (req, res) => {
  try {
    const book = await getBookByISBN(req.params.isbn)
    if (!book) return res.status(404).json({ error: 'Book not found' })
    res.json(book)
  } catch (err) {
    console.error('[books/:isbn]', err.message)
    res.status(500).json({ error: 'Failed to fetch book' })
  }
})

export default router
