import { useCallback, useState } from 'react'

const KEY = 'pathfinder-preferences'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { categories: [], summary: '' }
    const p = JSON.parse(raw)
    return {
      categories: Array.isArray(p.categories) ? p.categories : [],
      summary: typeof p.summary === 'string' ? p.summary : '',
    }
  } catch {
    return { categories: [], summary: '' }
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState(load)

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const setCategories = useCallback((categories) => {
    setPreferences((prev) => {
      const next = { ...prev, categories }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { preferences, updatePreference, setCategories }
}
