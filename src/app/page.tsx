'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, Settings } from 'lucide-react'
import { getNextDay } from '@/lib/workout-data'
import { getLastCompletedDay, getRecentWorkouts } from '@/lib/storage'
import type { DayNumber, WorkoutHistory } from '@/types/workout'
import { useWorkout } from '@/contexts/WorkoutContext'
import DaySelector from '@/components/dashboard/DaySelector'
import NextWorkoutCard from '@/components/dashboard/NextWorkoutCard'
import WorkoutHistoryComponent from '@/components/dashboard/WorkoutHistory'
import LiveActivityBar from '@/components/workout/LiveActivityBar'

export default function Home() {
  const router = useRouter()
  const { activeWorkout, getCompletedSets, getTotalSets } = useWorkout()

  const [selectedDay, setSelectedDay] = useState<DayNumber>(1)
  const [lastCompletedDay, setLastCompletedDay] = useState<DayNumber | null>(null)
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutHistory[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const lastDay = getLastCompletedDay()
    setLastCompletedDay(lastDay)
    setSelectedDay(getNextDay(lastDay))
    setRecentWorkouts(getRecentWorkouts(5))
    setIsLoaded(true)
  }, [])

  const handleResumeWorkout = () => {
    if (activeWorkout) {
      router.push(`/workout?day=${activeWorkout.dayNumber}`)
    }
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <Dumbbell className="w-12 h-12 text-duo-green animate-pulse" />
        </div>
      </main>
    )
  }

  return (
    <main className={`min-h-screen bg-background ${activeWorkout ? 'pb-32' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b-2 border-border px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-duo-green flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">LiftR</h1>
          </div>
          <Link
            href="/settings"
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <Settings className="w-5 h-5 text-foreground-muted" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Day Selector */}
        <DaySelector
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          lastCompletedDay={lastCompletedDay}
        />

        {/* Next Workout Card */}
        <NextWorkoutCard dayNumber={selectedDay} />

        {/* Workout History */}
        <WorkoutHistoryComponent workouts={recentWorkouts} />
      </div>

      {/* Live Activity Bar - shows when workout is active */}
      {activeWorkout && (
        <LiveActivityBar
          dayNumber={activeWorkout.dayNumber}
          dayName={activeWorkout.dayName}
          elapsedSeconds={activeWorkout.elapsedSeconds}
          completedSets={getCompletedSets()}
          totalSets={getTotalSets()}
          onResume={handleResumeWorkout}
        />
      )}
    </main>
  )
}
