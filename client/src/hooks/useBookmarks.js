import { useState } from 'react'

const KEY = 'onseojae_bookmarks'

export default function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
  })

  const isBookmarked = (isbn) => bookmarks.some(b => b.isbn === isbn)

  const toggle = (book) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.isbn === book.isbn)
      const next = exists
        ? prev.filter(b => b.isbn !== book.isbn)
        : [{ isbn: book.isbn, title: book.title, author: book.author, coverUrl: book.coverUrl }, ...prev]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const clearAll = () => {
    localStorage.removeItem(KEY)
    setBookmarks([])
  }

  return { bookmarks, isBookmarked, toggle, clearAll }
}
