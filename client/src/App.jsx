import { Routes, Route } from 'react-router-dom'
import SearchPage from './pages/SearchPage'
import BookDetailPage from './pages/BookDetailPage'
import EbooksPage from './pages/EbooksPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/book/:isbn" element={<BookDetailPage />} />
      <Route path="/ebooks" element={<EbooksPage />} />
    </Routes>
  )
}
