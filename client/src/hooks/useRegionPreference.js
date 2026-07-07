import { useState, useEffect } from 'react'

const KEY = 'onseojae_region_pref'

export default function useRegionPreference() {
  const [regions, setRegions] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(regions)) } catch {}
  }, [regions])

  return [regions, setRegions]
}
