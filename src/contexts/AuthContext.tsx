'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '@/lib/firebase'

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  spreadsheetId: string | null
  createdAt: Date | null
  lastLogin: Date | null
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateSpreadsheetId: (spreadsheetId: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch or create user profile in Firestore
  const fetchOrCreateUserProfile = useCallback(async (firebaseUser: User): Promise<UserProfile> => {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      // Update last login
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
      const data = userSnap.data()
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        spreadsheetId: data.spreadsheetId || null,
        createdAt: data.createdAt?.toDate() || null,
        lastLogin: new Date()
      }
    } else {
      // Create new user profile
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        spreadsheetId: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      }
      await setDoc(userRef, newProfile)
      return {
        ...newProfile,
        createdAt: new Date(),
        lastLogin: new Date()
      }
    }
  }, [])

  // Listen to auth state changes
  useEffect(() => {
    // Check localStorage for cached profile immediately
    const cachedProfile = localStorage.getItem('liftr_user_profile')
    if (cachedProfile) {
      try {
        setUserProfile(JSON.parse(cachedProfile))
      } catch {
        localStorage.removeItem('liftr_user_profile')
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Set loading to false immediately so UI is responsive
        setIsLoading(false)

        // Fetch profile in background (don't block UI)
        fetchOrCreateUserProfile(firebaseUser)
          .then(profile => {
            setUserProfile(profile)
            localStorage.setItem('liftr_user_profile', JSON.stringify(profile))
          })
          .catch(err => {
            console.error('Failed to fetch user profile:', err)
            // Use cached profile if available
          })
      } else {
        setUser(null)
        setUserProfile(null)
        localStorage.removeItem('liftr_user_profile')
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [fetchOrCreateUserProfile])

  const signInWithGoogleHandler = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signInWithEmailHandler = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signUpWithEmailHandler = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetPasswordHandler = useCallback(async (email: string) => {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email'
      setError(message)
      throw err
    }
  }, [])

  const signOutHandler = useCallback(async () => {
    setError(null)
    try {
      await firebaseSignOut(auth)
      localStorage.removeItem('liftr_user_profile')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out'
      setError(message)
      throw err
    }
  }, [])

  const updateSpreadsheetId = useCallback(async (spreadsheetId: string) => {
    if (!user) return

    const userRef = doc(db, 'users', user.uid)
    await setDoc(userRef, { spreadsheetId }, { merge: true })

    setUserProfile(prev => prev ? { ...prev, spreadsheetId } : null)

    // Update localStorage
    const cachedProfile = localStorage.getItem('liftr_user_profile')
    if (cachedProfile) {
      const profile = JSON.parse(cachedProfile)
      profile.spreadsheetId = spreadsheetId
      localStorage.setItem('liftr_user_profile', JSON.stringify(profile))
    }
  }, [user])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAuthenticated: !!user,
        isLoading,
        error,
        signInWithGoogle: signInWithGoogleHandler,
        signInWithEmail: signInWithEmailHandler,
        signUpWithEmail: signUpWithEmailHandler,
        resetPassword: resetPasswordHandler,
        signOut: signOutHandler,
        updateSpreadsheetId,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
