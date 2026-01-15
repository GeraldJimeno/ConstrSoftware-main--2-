import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const projectRef = supabase?.supabaseUrl?.split('https://')?.[1]?.split('.')?.[0]
  const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : null
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const accessTokenKey = 'labguard_access_token'

  const loadProfile = async (sessionUser, tokenOverride = null) => {
    if (!sessionUser) {
      setProfile(null)
      setRole(null)
      return
    }

    if (tokenOverride && supabaseUrl && supabaseAnonKey) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${sessionUser.id}&select=id,full_name,role_id,roles(slug,name)`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${tokenOverride}`,
            'Content-Type': 'application/json',
          },
        },
      )
      if (!response.ok) {
        setProfile(null)
        setRole(null)
        setError('No se pudo cargar el perfil. Contacta a un administrador.')
        return
      }
      const rows = await response.json()
      const data = rows?.[0]
      if (!data) {
        setProfile(null)
        setRole(null)
        setError('No se pudo cargar el perfil. Contacta a un administrador.')
        return
      }
      setProfile(data)
      setRole(data.roles?.slug || null)
      setUser(data.full_name || sessionUser.email)
      return
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role_id, roles (slug, name)')
      .eq('id', sessionUser.id)
      .single()

    if (profileError) {
      setProfile(null)
      setRole(null)
      setError('No se pudo cargar el perfil. Contacta a un administrador.')
      return
    }

    setProfile(data)
    setRole(data.roles?.slug || null)
    setUser(data.full_name || sessionUser.email)
  }

  const loadUserFromToken = async (token) => {
    if (!token || !supabaseUrl || !supabaseAnonKey) return
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return
    }

    const userData = await response.json()
    setAccessToken(token)
    setUser(userData?.email ?? null)
    await loadProfile(userData, token)
  }

  useEffect(() => {
    let mounted = true
    const hasStoredSession = authStorageKey && localStorage.getItem(authStorageKey)
    const fallbackTimer = hasStoredSession
      ? setTimeout(() => {
          if (mounted) {
            setLoading(false)
            setError('Tiempo de espera agotado al validar la sesion.')
          }
        }, 5000)
      : null

    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        const sessionUser = data?.session?.user ?? null
          const sessionToken = data?.session?.access_token ?? null
          if (sessionToken) {
            localStorage.setItem(accessTokenKey, sessionToken)
          }
          setAccessToken(sessionToken)
        setUser(sessionUser?.email ?? null)
          if (sessionUser) {
            await loadProfile(sessionUser)
          } else {
            const storedToken =
              localStorage.getItem(accessTokenKey) || getStoredSupabaseAccessToken()
            if (storedToken) {
              await loadUserFromToken(storedToken)
            }
          }
      } catch (sessionError) {
        if (mounted) {
          setError('No se pudo validar la sesion. Revisa tu configuracion.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          const sessionUser = session?.user ?? null
          const sessionToken = session?.access_token ?? null
          if (sessionToken) {
            localStorage.setItem(accessTokenKey, sessionToken)
          }
          setAccessToken(sessionToken)
          setUser(sessionUser?.email ?? null)
          setError(null)
          await loadProfile(sessionUser)
        } catch (sessionError) {
          setError('No se pudo actualizar la sesion. Revisa tu configuracion.')
        } finally {
          setLoading(false)
        }
      },
    )

    return () => {
      mounted = false
      if (fallbackTimer) {
        clearTimeout(fallbackTimer)
      }
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    setError(null)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      return { error: signInError }
    }

    if (!data?.session) {
      const sessionError = new Error('No se pudo crear la sesion. Revisa tu navegador o confirma el correo.')
      setError(sessionError.message)
      return { error: sessionError }
    }

    setAccessToken(data.session.access_token)
    setUser(data.user?.email ?? null)
    localStorage.setItem(accessTokenKey, data.session.access_token)
    await loadProfile(data.user, data.session.access_token)

    return { error: null }
  }

  const logout = async () => {
    setError(null)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setRole(null)
    setAccessToken(null)
    localStorage.removeItem(accessTokenKey)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        accessToken,
        loading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
