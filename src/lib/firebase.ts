import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyB_kqu53UGGRSWbUEfbvJCHsKdRQUGpQGI",
  authDomain: "liftr-84ab2.firebaseapp.com",
  projectId: "liftr-84ab2",
  storageBucket: "liftr-84ab2.firebasestorage.app",
  messagingSenderId: "515811999948",
  appId: "1:515811999948:web:6d94f6c1040e976bd40269",
  measurementId: "G-DZLL7188V5"
}

// Initialize Firebase only once
const existingApp = getApps()[0]
const app = existingApp ?? initializeApp(firebaseConfig)

// Auth
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const emailProvider = new EmailAuthProvider()

// Firestore with persistent cache (new API)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

// Analytics (only in browser)
export const initAnalytics = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getAnalytics(app)
  }
  return null
}

export default app
