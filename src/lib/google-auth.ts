// Google OAuth configuration
export const GOOGLE_CLIENT_ID = '891745882842-p0svoldou8vtp7sk11d6eoc90hn1nfid.apps.googleusercontent.com'
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

// Storage keys
const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'
const USER_KEY = 'google_user'
const SPREADSHEET_ID_KEY = 'liftr_spreadsheet_id'

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
}

// Get stored token
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null

  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

  if (!token || !expiry) return null

  // Check if token is expired
  if (Date.now() > parseInt(expiry)) {
    clearStoredAuth()
    return null
  }

  return token
}

// Store token
export function storeToken(token: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, (Date.now() + expiresIn * 1000).toString())
}

// Get stored user
export function getStoredUser(): GoogleUser | null {
  if (typeof window === 'undefined') return null
  const user = localStorage.getItem(USER_KEY)
  return user ? JSON.parse(user) : null
}

// Store user
export function storeUser(user: GoogleUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// Clear auth
export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(USER_KEY)
}

// Get spreadsheet ID
export function getSpreadsheetId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SPREADSHEET_ID_KEY)
}

// Store spreadsheet ID
export function storeSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id)
}

// Initialize Google Identity Services
export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'))
      return
    }

    // Check if already loaded
    if (window.google?.accounts) {
      resolve()
      return
    }

    // Load the Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

// Sign in with Google
export function signInWithGoogle(): Promise<{ token: string; user: GoogleUser }> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services not loaded'))
      return
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }

        const token = response.access_token
        const expiresIn = response.expires_in

        // Store the token
        storeToken(token, expiresIn)

        // Fetch user info
        try {
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
          })
          const userData = await userResponse.json()

          const user: GoogleUser = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            picture: userData.picture
          }

          storeUser(user)
          resolve({ token, user })
        } catch (error) {
          reject(error)
        }
      }
    })

    client.requestAccessToken()
  })
}

// Sign out
export function signOut(): void {
  const token = getStoredToken()
  if (token && window.google?.accounts) {
    window.google.accounts.oauth2.revoke(token, () => {
      clearStoredAuth()
    })
  } else {
    clearStoredAuth()
  }
}

// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token: string
              expires_in: number
              error?: string
            }) => void
          }) => {
            requestAccessToken: () => void
          }
          revoke: (token: string, callback: () => void) => void
        }
      }
    }
  }
}
