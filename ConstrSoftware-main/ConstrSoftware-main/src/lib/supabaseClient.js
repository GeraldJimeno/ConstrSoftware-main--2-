import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables.')
}

const createMemoryStorage = () => {
  let store = {}
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value
    },
    removeItem: (key) => {
      delete store[key]
    },
  }
}

const canUseStorage = (storage) => {
  if (!storage) return false
  try {
    const testKey = '__sb_test__'
    storage.setItem(testKey, '1')
    storage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

let storage
if (typeof window !== 'undefined') {
  if (canUseStorage(window.localStorage)) {
    storage = window.localStorage
  } else if (canUseStorage(window.sessionStorage)) {
    storage = window.sessionStorage
  } else {
    storage = createMemoryStorage()
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
  },
})
