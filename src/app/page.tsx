'use client'

import { Dumbbell } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-electric-blue" />
            <h1 className="text-xl font-bold text-foreground">LiftR</h1>
          </div>
        </div>
      </header>

      {/* Main Content - Blank Dashboard */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <Dumbbell className="mb-4 h-16 w-16 text-gray-300" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">Welcome to LiftR</h2>
          <p className="text-muted">Your workout dashboard is coming soon.</p>
        </div>
      </div>
    </main>
  )
}
