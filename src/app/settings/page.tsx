'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, LogOut, Check, Loader2, Mail, Eye, EyeOff, FileSpreadsheet, Link2, BarChart3, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { syncFirestoreToLocal } from '@/lib/firestore'
import {
  initGoogleAuth,
  signInWithGoogle as googleSheetsSignIn,
  getStoredToken,
  getStoredUser,
  getSpreadsheetId,
  storeSpreadsheetId,
  clearStoredAuth,
  type GoogleUser
} from '@/lib/google-auth'
import { getOrCreateSpreadsheet, generateCharts, verifySpreadsheetAccess } from '@/lib/google-sheets'
import Button from '@/components/ui/Button'

type AuthMode = 'signin' | 'signup' | 'reset'

export default function SettingsPage() {
  const {
    user,
    userProfile,
    isAuthenticated,
    isLoading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    updateSpreadsheetId,
    clearError
  } = useAuth()

  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Google Sheets state (separate from Firebase auth)
  const [sheetsUser, setSheetsUser] = useState<GoogleUser | null>(null)
  const [sheetsToken, setSheetsToken] = useState<string | null>(null)
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(null)
  const [isConnectingSheets, setIsConnectingSheets] = useState(false)
  const [sheetsError, setSheetsError] = useState<string | null>(null)
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false)
  const [chartsSuccess, setChartsSuccess] = useState(false)

  // Sync & Verify state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load Google Sheets connection state
  useEffect(() => {
    setSheetsToken(getStoredToken())
    setSheetsUser(getStoredUser())
    setSpreadsheetIdState(getSpreadsheetId())
  }, [])

  // Sync data when user logs in
  useEffect(() => {
    if (user) {
      syncFirestoreToLocal(user.uid).catch(console.error)
    }
  }, [user])

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    try {
      await signInWithGoogle()
    } catch {
      // Error handled in context
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    clearError()

    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password)
      } else if (authMode === 'signup') {
        await signUpWithEmail(email, password)
      } else if (authMode === 'reset') {
        await resetPassword(email)
        setResetSent(true)
      }
      setEmail('')
      setPassword('')
    } catch {
      // Error handled in context
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode)
    clearError()
    setResetSent(false)
  }

  // Google Sheets connection handlers
  const handleConnectSheets = async () => {
    setIsConnectingSheets(true)
    setSheetsError(null)

    try {
      await initGoogleAuth()
      const { token, user: gUser } = await googleSheetsSignIn()
      setSheetsToken(token)
      setSheetsUser(gUser)

      // Create or get spreadsheet
      // Pass the Firebase profile's spreadsheetId so we can reuse it on new devices
      const sheetId = await getOrCreateSpreadsheet(userProfile?.spreadsheetId)
      setSpreadsheetIdState(sheetId)

      // Sync to Firebase if logged in
      if (user) {
        await updateSpreadsheetId(sheetId)
      }
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setIsConnectingSheets(false)
    }
  }

  const handleDisconnectSheets = () => {
    clearStoredAuth()
    setSheetsToken(null)
    setSheetsUser(null)
    setSpreadsheetIdState(null)
  }

  const handleGenerateCharts = async () => {
    setIsGeneratingCharts(true)
    setSheetsError(null)
    setChartsSuccess(false)

    try {
      await generateCharts()
      setChartsSuccess(true)
      // Open the spreadsheet in a new tab
      if (spreadsheetId) {
        window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`, '_blank')
      }
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : 'Failed to generate charts')
    } finally {
      setIsGeneratingCharts(false)
    }
  }

  const isSheetsConnected = !!sheetsToken && !!spreadsheetId

  // Sync & Verify handler - checks localStorage, Firebase, and Google Sheets are all in sync
  const handleSyncAndVerify = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const issues: string[] = []
      const fixes: string[] = []

      const localSheetId = getSpreadsheetId()
      const firebaseSheetId = userProfile?.spreadsheetId

      // Check 1: Is user logged in?
      if (!user || !userProfile) {
        setSyncResult({ success: false, message: 'Please sign in to your account first.' })
        return
      }

      // Check 2: Is Google Sheets connected?
      const token = getStoredToken()
      if (!token) {
        setSyncResult({ success: false, message: 'Please connect Google Sheets first.' })
        return
      }

      // Check 3: Do we have any spreadsheet ID?
      if (!localSheetId && !firebaseSheetId) {
        setSyncResult({ success: false, message: 'No spreadsheet found. Please connect Google Sheets to create one.' })
        return
      }

      // Check 4: Verify local spreadsheet is accessible
      let localAccessible = false
      if (localSheetId) {
        localAccessible = await verifySpreadsheetAccess(localSheetId)
        if (!localAccessible) {
          issues.push('Local spreadsheet ID is not accessible')
        }
      }

      // Check 5: Verify Firebase spreadsheet is accessible
      let firebaseAccessible = false
      if (firebaseSheetId) {
        firebaseAccessible = await verifySpreadsheetAccess(firebaseSheetId)
        if (!firebaseAccessible) {
          issues.push('Firebase spreadsheet ID is not accessible')
        }
      }

      // Check 6: Are they in sync?
      if (localSheetId && firebaseSheetId && localSheetId !== firebaseSheetId) {
        issues.push('Local and Firebase spreadsheet IDs do not match')

        // Prefer Firebase ID if accessible (it's the source of truth for cross-device)
        if (firebaseAccessible) {
          storeSpreadsheetId(firebaseSheetId)
          setSpreadsheetIdState(firebaseSheetId)
          fixes.push('Updated local storage to match Firebase')
        } else if (localAccessible) {
          await updateSpreadsheetId(localSheetId)
          fixes.push('Updated Firebase to match local storage')
        }
      }

      // Check 7: Local exists but Firebase doesn't
      if (localSheetId && localAccessible && !firebaseSheetId) {
        await updateSpreadsheetId(localSheetId)
        fixes.push('Saved spreadsheet ID to Firebase')
      }

      // Check 8: Firebase exists but local doesn't
      if (firebaseSheetId && firebaseAccessible && !localSheetId) {
        storeSpreadsheetId(firebaseSheetId)
        setSpreadsheetIdState(firebaseSheetId)
        fixes.push('Restored spreadsheet ID from Firebase')
      }

      // Sync workout data from Firestore to local
      await syncFirestoreToLocal(user.uid)
      fixes.push('Synced workout data from cloud')

      // Build result message
      if (issues.length === 0 && fixes.length === 1) {
        setSyncResult({ success: true, message: 'Everything is in sync!' })
      } else {
        const message = fixes.length > 0
          ? `Fixed: ${fixes.join(', ')}`
          : 'Everything is in sync!'
        setSyncResult({ success: true, message })
      }

    } catch (err) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Sync failed. Please try again.'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b-2 border-border px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Account Section - Firebase Auth */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Account</h2>

          {isLoading && !isSubmitting ? (
            <div className="flex items-center gap-3 text-foreground-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : isAuthenticated && user ? (
            <div className="space-y-4">
              {/* Connected user info */}
              <div className="flex items-center gap-4 p-4 bg-duo-green/10 rounded-2xl">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'User'}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-duo-green flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-foreground">
                    {userProfile?.displayName || 'Connected'}
                  </p>
                  <p className="text-sm text-foreground-muted">{user.email}</p>
                </div>
              </div>

              <p className="text-sm text-foreground-muted">
                Your workout data syncs automatically to the cloud.
              </p>

              {/* Sign out button */}
              <Button variant="outline" className="w-full" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-foreground-muted">
                Sign in to sync your workouts across devices and never lose your progress.
              </p>

              {error && (
                <div className="p-3 bg-duo-red/10 text-duo-red rounded-xl text-sm">
                  {error}
                </div>
              )}

              {resetSent && (
                <div className="p-3 bg-duo-green/10 text-duo-green rounded-xl text-sm">
                  Password reset email sent! Check your inbox.
                </div>
              )}

              {/* Google Sign In */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-foreground-muted">or</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-duo-blue"
                    required
                  />
                </div>

                {authMode !== 'reset' && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-duo-blue pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-5 h-5 mr-2" />
                  )}
                  {authMode === 'signin' && 'Sign In'}
                  {authMode === 'signup' && 'Create Account'}
                  {authMode === 'reset' && 'Send Reset Email'}
                </Button>
              </form>

              {/* Auth mode switches */}
              <div className="flex flex-col items-center gap-2 text-sm">
                {authMode === 'signin' && (
                  <>
                    <button
                      onClick={() => switchMode('signup')}
                      className="text-duo-blue hover:underline"
                    >
                      Don&apos;t have an account? Sign up
                    </button>
                    <button
                      onClick={() => switchMode('reset')}
                      className="text-foreground-muted hover:underline"
                    >
                      Forgot password?
                    </button>
                  </>
                )}
                {authMode === 'signup' && (
                  <button
                    onClick={() => switchMode('signin')}
                    className="text-duo-blue hover:underline"
                  >
                    Already have an account? Sign in
                  </button>
                )}
                {authMode === 'reset' && (
                  <button
                    onClick={() => switchMode('signin')}
                    className="text-duo-blue hover:underline"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Google Sheets Connection - Separate from Firebase auth */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-duo-green" />
            Google Sheets Export
          </h2>

          {isSheetsConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-duo-green/10 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-duo-green flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Connected</p>
                  <p className="text-sm text-foreground-muted">{sheetsUser?.email}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-sm text-foreground-muted mb-2">Your workouts export to:</p>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-duo-blue font-medium hover:underline break-all"
                >
                  Open LiftR Spreadsheet
                </a>
              </div>

              {/* Generate Charts Button */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleGenerateCharts}
                disabled={isGeneratingCharts}
              >
                {isGeneratingCharts ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Charts...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Generate Dashboard & Charts
                  </>
                )}
              </Button>

              {chartsSuccess && (
                <div className="p-3 bg-duo-green/10 text-duo-green rounded-xl text-sm">
                  Charts generated! Opening spreadsheet...
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={handleDisconnectSheets}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect Google Sheets
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-foreground-muted">
                Connect Google Sheets to export your workouts to a spreadsheet for analysis and backup.
              </p>

              <ul className="text-sm text-foreground-muted space-y-1 ml-4">
                <li>• Export workout history</li>
                <li>• Create charts and visualizations</li>
                <li>• Access data from anywhere</li>
              </ul>

              {sheetsError && (
                <div className="p-3 bg-duo-red/10 text-duo-red rounded-xl text-sm">
                  {sheetsError}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleConnectSheets}
                disabled={isConnectingSheets}
              >
                {isConnectingSheets ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    Connect Google Sheets
                  </>
                )}
              </Button>
            </div>
          )}
        </section>

        {/* Analytics Link */}
        <section className="card p-6">
          <Link href="/analytics" className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Analytics</h2>
              <p className="text-sm text-foreground-muted">View your workout statistics</p>
            </div>
            <ArrowLeft className="w-5 h-5 text-foreground-muted rotate-180" />
          </Link>
        </section>

        {/* App Info */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">About</h2>
          <div className="space-y-2 text-sm text-foreground-muted">
            <p><strong>LiftR</strong> - Workout Tracker</p>
            <p>Version 1.0.0</p>
          </div>
        </section>

        {/* Sync & Verify */}
        <section className="card p-6">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-duo-blue" />
            Sync & Verify
          </h2>
          <p className="text-sm text-foreground-muted mb-4">
            Check that your data is properly synced between this device, Firebase, and Google Sheets.
          </p>

          {syncResult && (
            <div className={`p-3 rounded-xl text-sm mb-4 ${
              syncResult.success
                ? 'bg-duo-green/10 text-duo-green'
                : 'bg-duo-red/10 text-duo-red'
            }`}>
              {syncResult.message}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSyncAndVerify}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Sync & Verify Data
              </>
            )}
          </Button>
        </section>
      </div>
    </main>
  )
}
