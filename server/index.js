import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import booksRouter from './routes/books.js'
import librariesRouter from './routes/libraries.js'
import rankingsRouter from './routes/rankings.js'
import ebooksRouter from './routes/ebooks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const PORT = process.env.PORT || 3001

if (!isProd) {
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
}
app.use(express.json())

app.use('/api/books', booksRouter)
app.use('/api/libraries', librariesRouter)
app.use('/api/rankings', rankingsRouter)
app.use('/api/ebooks', ebooksRouter)

app.get('/api/health', (_, res) => res.json({ ok: true }))

if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (NODE_ENV=${process.env.NODE_ENV || 'development'})`)
})
