import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Session cache keys
const SESSION_CACHE_KEY = 'parking_hub_session_cache'
const PROFILE_CACHE_KEY = 'parking_hub_profile_cache'

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)

  useEffect(() => {
    let isMounted = true
    let timeoutId = null

    // Get initial session with timeout and error handling
    const getInitialSession = async () => {
      try {
        // Set a safety timeout - if loading takes more than 10 seconds, stop loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('Auth check timed out after 10 seconds')
            setLoading(false)
            // Try to restore from cache as fallback
            restoreFromCache()
          }
        }, 10000)

        // First, try to restore cached session for instant login
        const restored = restoreFromCache()

        // Then check actual session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          // If we have cached data, keep using it
          if (!restored) {
            if (isMounted) setLoading(false)
          }
          return
        }

        if (session?.user && isMounted) {
          setUser(session.user)
          // Cache the session
          cacheSession(session.user)
          await fetchUserProfile(session.user)
        } else if (!restored && isMounted) {
          // No session and no cache - user needs to login
          clearCache()
        }

        if (isMounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
        if (isMounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)

        if (session?.user && isMounted) {
          setUser(session.user)
          cacheSession(session.user)
          await fetchUserProfile(session.user)
        } else if (isMounted) {
          setUser(null)
          setUserProfile(null)
          clearCache()
        }

        if (isMounted) {
          setLoading(false)
        }
      }
    )

    // Listen for storage events (session changes in other tabs)
    const handleStorageChange = (e) => {
      if (e.key === SESSION_CACHE_KEY && e.newValue === null && isMounted) {
        // Session was cleared in another tab
        setUser(null)
        setUserProfile(null)
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Cache session to localStorage for instant login
  const cacheSession = (user) => {
    try {
      if (user) {
        const sessionData = {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
          cachedAt: new Date().toISOString()
        }
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(sessionData))
      }
    } catch (error) {
      console.error('Error caching session:', error)
    }
  }

  // Cache profile for instant restore
  const cacheProfile = (profile) => {
    try {
      if (profile) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
      }
    } catch (error) {
      console.error('Error caching profile:', error)
    }
  }

  // Restore session from cache
  const restoreFromCache = () => {
    try {
      const cachedSession = localStorage.getItem(SESSION_CACHE_KEY)
      const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY)

      if (cachedSession && cachedProfile) {
        const session = JSON.parse(cachedSession)
        const profile = JSON.parse(cachedProfile)

        // Check if cache is not too old (24 hours)
        const cacheAge = new Date() - new Date(session.cachedAt)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (cacheAge < maxAge) {
          setUser(session)
          setUserProfile(profile)
          console.log('Restored session from cache')
          return true
        } else {
          // Cache is too old, clear it
          clearCache()
        }
      }
    } catch (error) {
      console.error('Error restoring from cache:', error)
      clearCache()
    }
    return false
  }

  // Clear cached session
  const clearCache = () => {
    try {
      localStorage.removeItem(SESSION_CACHE_KEY)
      localStorage.removeItem(PROFILE_CACHE_KEY)
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }

  const fetchUserProfile = async (user) => {
    if (!user) return;

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      )

      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Race between fetch and timeout
      let { data: profile, error } = await Promise.race([fetchPromise, timeoutPromise])
        .catch(err => {
          console.error('Profile fetch failed:', err)
          // Try to restore from cache
          const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY)
          if (cachedProfile) {
            return { data: JSON.parse(cachedProfile), error: null }
          }
          return { data: null, error: err }
        })

      // If profile doesn't exist, create one
      if (error && error.code === 'PGRST116') {
        console.log('Creating new user profile for:', user.id);
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              name: user.user_metadata?.name || user.email,
              email: user.email,
              role: 'user' // Default role
            }
          ])
          .select()
          .single()

        if (insertError) {
          console.error('Error creating profile:', insertError)
          return
        }

        profile = newProfile
      } else if (error && error.message !== 'Profile fetch timeout') {
        console.error('Error fetching profile:', error)
        return
      }

      if (profile) {
        setUserProfile(profile)
        cacheProfile(profile)
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      // Try to use cached profile as fallback
      try {
        const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY)
        if (cachedProfile) {
          setUserProfile(JSON.parse(cachedProfile))
        }
      } catch {}
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUserProfile(null);
      clearCache(); // Clear cached session
      // Clear admin dashboard cache
      sessionStorage.removeItem('admin_recent_payments');
      console.log('User logged out, all caches cleared');
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if signOut fails, clear local state and cache
      setUser(null);
      setUserProfile(null);
      clearCache();
      sessionStorage.removeItem('admin_recent_payments');
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}