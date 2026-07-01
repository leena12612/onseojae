import { useState, useEffect } from 'react'

const KEY = 'onseojae_library_favorites'

export default function useLibraryFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(favorites))
  }, [favorites])

  const isFavorite = (name) => favorites.includes(name)

  const toggle = (name) => {
    setFavorites(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  return { favorites, isFavorite, toggle }
}
