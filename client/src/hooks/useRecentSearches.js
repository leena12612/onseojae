import { useState } from 'react'

const KEY = 'onseojae_recent_searches'
const MAX = 8

export default function useRecentSearches() {
  const [recents, setRecents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
  })

  const add = (query) => {
    const q = query.trim()
    if (!q) return
    setRecents(prev => {
      const next = [q, ...prev.filter(r => r !== q)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const remove = (query) => {
    setRecents(prev => {
      const next = prev.filter(r => r !== query)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const clear = () => {
    localStorage.removeItem(KEY)
    setRecents([])
  }

  return { recents, add, remove, clear }
}
