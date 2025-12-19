'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  initGoogleAuth,
  signInWithGoogle,
  signOut as googleSignOut,
  getStoredToken,
  getStoredUser,
  type GoogleUser,
} from '@/lib/google-auth'
import { getOrCreateSpreadsheet } from '@/lib/google-sheets'

interface GoogleAuthContextType {
  user: GoogleUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => void
  error: string | null
}

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null)

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await initGoogleAuth()

        const token = getStoredToken()
        const storedUser = getStoredUser()

        if (token && storedUser) {
          setUser(storedUser)
        }
      } catch (err) {
        console.error('Failed to initialize Google Auth:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const signIn = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await initGoogleAuth()
      const { user: newUser } = await signInWithGoogle()
      setUser(newUser)

      // Initialize or connect to spreadsheet
      await getOrCreateSpreadsheet()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(message)
      console.error('Sign in error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    googleSignOut()
    setUser(null)
  }, [])

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signOut,
        error,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  )
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext)
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider')
  }
  return context
}
