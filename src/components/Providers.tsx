'use client'

import { useEffect } from 'react'
import { WorkoutProvider } from '@/contexts/WorkoutContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { initAnalytics } from '@/lib/firebase'
import type { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initialize Firebase Analytics
    initAnalytics()
  }, [])

  return (
    <AuthProvider>
      <WorkoutProvider>{children}</WorkoutProvider>
    </AuthProvider>
  )
}
