'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Flame, Clock, Dumbbell, TrendingUp, Calendar, Target } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { calculateWorkoutStats, type WorkoutStats } from '@/lib/firestore'
import type { WorkoutHistory, DayNumber } from '@/types/workout'

// Calculate stats from localStorage as fallback
function calculateLocalStats(): WorkoutStats {
  const workoutsJson = localStorage.getItem('liftr_workout_history')
  const workouts: WorkoutHistory[] = workoutsJson ? JSON.parse(workoutsJson) : []

  console.log('[Analytics] Local workouts count:', workouts.length)

  const stats: WorkoutStats = {
    totalWorkouts: workouts.length,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    workoutsByDay: { 1: 0, 2: 0, 3: 0, 4: 0 },
    workoutsByMonth: {},
    averageDuration: 0,
    streakDays: 0,
    exerciseStats: {}
  }

  if (workouts.length === 0) return stats

  // Calculate streak
  const sortedDates = workouts
    .map(w => new Date(w.date).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let streak = 0
  const today = new Date()
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    if (sortedDates[i] === expectedDate.toDateString()) {
      streak++
    } else {
      break
    }
  }
  stats.streakDays = streak

  // Process workouts
  for (const workout of workouts) {
    stats.totalDuration += workout.duration
    stats.workoutsByDay[workout.dayNumber as DayNumber]++

    const month = workout.date.substring(0, 7) // YYYY-MM
    stats.workoutsByMonth[month] = (stats.workoutsByMonth[month] || 0) + 1

    for (const exercise of workout.exercises) {
      if (!stats.exerciseStats[exercise.name]) {
        stats.exerciseStats[exercise.name] = {
          totalSets: 0,
          totalReps: 0,
          maxWeight: 0,
          lastWeight: 0
        }
      }

      const exerciseStat = stats.exerciseStats[exercise.name]
      if (!exerciseStat) continue

      for (const set of exercise.sets) {
        if (set.completed) {
          stats.totalSets++
          stats.totalReps += set.actualReps
          exerciseStat.totalSets++
          exerciseStat.totalReps += set.actualReps
          exerciseStat.maxWeight = Math.max(exerciseStat.maxWeight, set.weight)
        }
      }

      // Get last weight from most recent workout
      const lastSet = exercise.sets.find(s => s.completed)
      if (lastSet) {
        exerciseStat.lastWeight = lastSet.weight
      }
    }
  }

  stats.averageDuration = workouts.length > 0 ? Math.round(stats.totalDuration / workouts.length) : 0

  return stats
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function StatCard({ icon: Icon, label, value, subValue }: {
  icon: typeof Flame
  label: string
  value: string | number
  subValue?: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-duo-green/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-duo-green" />
        </div>
        <span className="text-sm text-foreground-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subValue && <p className="text-sm text-foreground-muted">{subValue}</p>}
    </div>
  )
}

function DayDistribution({ workoutsByDay }: { workoutsByDay: Record<1 | 2 | 3 | 4, number> }) {
  const dayNames = ['Day 1', 'Day 2', 'Day 3', 'Day 4']
  const total = Object.values(workoutsByDay).reduce((a, b) => a + b, 0)
  const maxCount = Math.max(...Object.values(workoutsByDay), 1)

  return (
    <div className="card p-4">
      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-duo-blue" />
        Workouts by Day
      </h3>
      <div className="space-y-3">
        {([1, 2, 3, 4] as const).map((day) => {
          const count = workoutsByDay[day]
          const percentage = total > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={day}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{dayNames[day - 1]}</span>
                <span className="text-foreground-muted">{count}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-duo-blue rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExerciseLeaderboard({ exerciseStats }: {
  exerciseStats: Record<string, { totalSets: number; totalReps: number; maxWeight: number; lastWeight: number }>
}) {
  const sortedExercises = Object.entries(exerciseStats)
    .sort(([, a], [, b]) => b.totalSets - a.totalSets)
    .slice(0, 10)

  if (sortedExercises.length === 0) {
    return null
  }

  return (
    <div className="card p-4">
      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-duo-orange" />
        Top Exercises
      </h3>
      <div className="space-y-3">
        {sortedExercises.map(([name, stats], index) => (
          <div key={name} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                index === 1 ? 'bg-gray-300 text-gray-700' :
                index === 2 ? 'bg-orange-300 text-orange-800' :
                'bg-gray-100 text-gray-600'}`}>
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{name}</p>
              <p className="text-xs text-foreground-muted">
                {stats.totalSets} sets • Max: {stats.maxWeight}lbs
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlyChart({ workoutsByMonth }: { workoutsByMonth: Record<string, number> }) {
  const months = Object.entries(workoutsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // Last 6 months

  if (months.length === 0) {
    return null
  }

  const maxCount = Math.max(...months.map(([, count]) => count), 1)

  return (
    <div className="card p-4">
      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-duo-green" />
        Monthly Progress
      </h3>
      <div className="flex items-end gap-2 h-32">
        {months.map(([month, count]) => {
          const height = (count / maxCount) * 100
          const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-foreground">{count}</span>
              <div className="w-full bg-gray-100 rounded-t-lg" style={{ height: '100px' }}>
                <div
                  className="w-full bg-duo-green rounded-t-lg transition-all duration-500"
                  style={{ height: `${height}%`, marginTop: `${100 - height}%` }}
                />
              </div>
              <span className="text-xs text-foreground-muted">{monthName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [stats, setStats] = useState<WorkoutStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      console.log('[Analytics] Loading stats, user:', user?.uid)
      setIsLoading(true)

      try {
        // Try Firestore first if user is logged in
        if (user) {
          console.log('[Analytics] Attempting to load from Firestore...')
          const workoutStats = await calculateWorkoutStats(user.uid)
          console.log('[Analytics] Firestore stats:', workoutStats)
          setStats(workoutStats)
        } else {
          // Fall back to local storage
          console.log('[Analytics] No user, loading from localStorage...')
          const localStats = calculateLocalStats()
          console.log('[Analytics] Local stats:', localStats)
          setStats(localStats)
        }
      } catch (error) {
        console.error('[Analytics] Failed to load from Firestore, falling back to localStorage:', error)
        // Fall back to local storage on error
        const localStats = calculateLocalStats()
        console.log('[Analytics] Fallback local stats:', localStats)
        setStats(localStats)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [user])

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-white border-b-2 border-border px-4 py-4">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <Link
              href="/settings"
              className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-muted" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-duo-green animate-spin" />
        </div>
      </main>
    )
  }

  // Remove auth requirement - show local stats even without signing in

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b-2 border-border px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link
            href="/settings"
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {!stats || stats.totalWorkouts === 0 ? (
          <div className="card p-8 text-center">
            <Dumbbell className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">No workouts yet</h2>
            <p className="text-foreground-muted">
              Complete your first workout to start tracking your progress!
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-duo-blue hover:underline"
            >
              Start a workout
            </Link>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                icon={Flame}
                label="Streak"
                value={`${stats.streakDays} days`}
                subValue="Keep it up!"
              />
              <StatCard
                icon={Dumbbell}
                label="Total Workouts"
                value={stats.totalWorkouts}
              />
              <StatCard
                icon={Clock}
                label="Time Training"
                value={formatDuration(stats.totalDuration)}
                subValue={`~${formatDuration(stats.averageDuration)} avg`}
              />
              <StatCard
                icon={Target}
                label="Total Sets"
                value={stats.totalSets.toLocaleString()}
                subValue={`${stats.totalReps.toLocaleString()} reps`}
              />
            </div>

            {/* Monthly Progress Chart */}
            <MonthlyChart workoutsByMonth={stats.workoutsByMonth} />

            {/* Day Distribution */}
            <DayDistribution workoutsByDay={stats.workoutsByDay} />

            {/* Exercise Leaderboard */}
            <ExerciseLeaderboard exerciseStats={stats.exerciseStats} />
          </>
        )}
      </div>
    </main>
  )
}
