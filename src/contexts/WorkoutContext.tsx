'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { getWorkoutDay } from '@/lib/workout-data'
import { getExerciseWeight } from '@/lib/storage'
import type { DayNumber, ExerciseLog } from '@/types/workout'

interface ActiveWorkout {
  dayNumber: DayNumber
  dayName: string
  exerciseLogs: ExerciseLog[]
  elapsedSeconds: number
  isPaused: boolean
  startedAt: number
}

interface WorkoutContextType {
  activeWorkout: ActiveWorkout | null
  startWorkout: (dayNumber: DayNumber) => void
  endWorkout: () => void
  updateExerciseLogs: (logs: ExerciseLog[]) => void
  togglePause: () => void
  getCompletedSets: () => number
  getTotalSets: () => number
}

const WorkoutContext = createContext<WorkoutContextType | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Timer effect
  const isPaused = activeWorkout?.isPaused ?? true
  const isActive = activeWorkout !== null

  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setActiveWorkout(prev => prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, isActive])

  const startWorkout = useCallback((dayNumber: DayNumber) => {
    const workout = getWorkoutDay(dayNumber)
    const exerciseLogs: ExerciseLog[] = workout.exercises.map((ex) => ({
      name: ex.name,
      tier: ex.tier,
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        targetReps: ex.reps,
        actualReps: 0,
        weight: getExerciseWeight(ex.name),
        completed: false,
      })),
    }))

    setActiveWorkout({
      dayNumber,
      dayName: workout.name,
      exerciseLogs,
      elapsedSeconds: 0,
      isPaused: false,
      startedAt: Date.now(),
    })
  }, [])

  const endWorkout = useCallback(() => {
    console.log('[WorkoutContext] Ending workout, clearing state')
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setActiveWorkout(null)
  }, [])

  const updateExerciseLogs = useCallback((logs: ExerciseLog[]) => {
    setActiveWorkout(prev => prev ? { ...prev, exerciseLogs: logs } : null)
  }, [])

  const togglePause = useCallback(() => {
    setActiveWorkout(prev => prev ? { ...prev, isPaused: !prev.isPaused } : null)
  }, [])

  const getCompletedSets = useCallback(() => {
    if (!activeWorkout) return 0
    return activeWorkout.exerciseLogs.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    )
  }, [activeWorkout])

  const getTotalSets = useCallback(() => {
    if (!activeWorkout) return 0
    return activeWorkout.exerciseLogs.reduce((acc, ex) => acc + ex.sets.length, 0)
  }, [activeWorkout])

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        startWorkout,
        endWorkout,
        updateExerciseLogs,
        togglePause,
        getCompletedSets,
        getTotalSets,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  )
}

export function useWorkout() {
  const context = useContext(WorkoutContext)
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider')
  }
  return context
}
