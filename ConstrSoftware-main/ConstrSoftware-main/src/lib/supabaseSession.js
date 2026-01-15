const getProjectRef = (url) => {
  if (!url) return null
  const withoutProto = url.replace('https://', '').replace('http://', '')
  return withoutProto.split('.')[0]
}

export const getStoredSupabaseAccessToken = () => {
  if (typeof window === 'undefined') return null
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const projectRef = getProjectRef(supabaseUrl)
  if (!projectRef) return null

  const storageKey = `sb-${projectRef}-auth-token`
  const raw = window.localStorage?.getItem(storageKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed?.access_token || null
  } catch {
    return null
  }
}
