import { useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value: T | ((prev: T) => T)) => {
    const next = value instanceof Function ? value(storedValue) : value
    setStoredValue(next)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
    }
  }

  return [storedValue, setValue] as const
}
