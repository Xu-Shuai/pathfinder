import { useCallback, useEffect, useRef, useState } from 'react'

const DB_NAME = 'pathfinder-collection'
const STORE = 'collections'
const VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useCollection() {
  const dbRef = useRef(null)
  const [items, setItems] = useState([])

  const refresh = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const q = tx.objectStore(STORE).getAll()
      q.onsuccess = () => resolve(q.result || [])
      q.onerror = () => reject(q.error)
    })
    setItems(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    openDb()
      .then((db) => {
        if (cancelled) return
        dbRef.current = db
        return refresh()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [refresh])

  const addItem = useCallback(
    async (item) => {
      const db = dbRef.current
      if (!db) return
      const row = {
        id: crypto.randomUUID(),
        title: item.title || '收藏',
        detail: item.detail || '',
        savedAt: Date.now(),
      }
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(row)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      await refresh()
    },
    [refresh],
  )

  const removeItem = useCallback(
    async (id) => {
      const db = dbRef.current
      if (!db) return
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(id)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      await refresh()
    },
    [refresh],
  )

  const getItems = useCallback(async () => items, [items])

  return { items, addItem, removeItem, getItems }
}
