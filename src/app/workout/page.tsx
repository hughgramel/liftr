'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, ChevronDown, Maximize2, X } from 'lucide-react'
import { getWorkoutDay } from '@/lib/workout-data'
import {
  addWorkoutToHistory,
  setLastCompletedDay,
  generateWorkoutId,
  getUserSettings,
} from '@/lib/storage'
import { appendWorkout, updateChartsAfterWorkout } from '@/lib/google-sheets'
import { getStoredToken } from '@/lib/google-auth'
import type { DayNumber } from '@/types/workout'
import { useWorkout } from '@/contexts/WorkoutContext'
import Button from '@/components/ui/Button'
import WorkoutTimer from '@/components/workout/WorkoutTimer'
import RestTimer from '@/components/workout/RestTimer'
import ExerciseCard from '@/components/workout/ExerciseCard'
import FocusMode from '@/components/workout/FocusMode'

function WorkoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const dayParam = searchParams.get('day')
  const dayNumber = (parseInt(dayParam || '1') || 1) as DayNumber

  const {
    activeWorkout,
    startWorkout,
    endWorkout,
    updateExerciseLogs,
    togglePause,
    getCompletedSets,
    getTotalSets,
  } = useWorkout()

  const workout = getWorkoutDay(dayNumber)
  const settings = getUserSettings()

  // Rest timer state
  const [showRestTimer, setShowRestTimer] = useState(false)
  const [restSeconds, setRestSeconds] = useState(settings.restTimerSeconds)
  const restTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Focus mode state
  const [showFocusMode, setShowFocusMode] = useState(false)

  // Active exercise index (for highlighting)
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)

  // Confirmation dialog
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  // Only start a new workout if explicitly requested (no active workout)
  // Don't auto-start if just navigating to the page
  const hasStartedRef = useRef(false)
  useEffect(() => {
    if (!activeWorkout && !hasStartedRef.current) {
      hasStartedRef.current = true
      startWorkout(dayNumber)
    }
  }, [dayNumber, activeWorkout, startWorkout])

  // Rest timer
  useEffect(() => {
    if (showRestTimer && restSeconds > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSeconds((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current)
    }
  }, [showRestTimer, restSeconds])

  const handleSetComplete = useCallback(
    (exerciseIndex: number, setIndex: number, reps: number, weight: number) => {
      if (!activeWorkout) return

      const updatedLogs = activeWorkout.exerciseLogs.map((ex, exIdx) =>
        exIdx === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((set, idx) =>
                idx === setIndex ? { ...set, actualReps: reps, weight, completed: true } : set
              ),
            }
          : ex
      )
      updateExerciseLogs(updatedLogs)

      // Show rest timer (only in non-focus mode)
      if (!showFocusMode) {
        setRestSeconds(settings.restTimerSeconds)
        setShowRestTimer(true)
      }
    },
    [activeWorkout, updateExerciseLogs, settings.restTimerSeconds, showFocusMode]
  )

  const handleRestComplete = useCallback(() => {
    setShowRestTimer(false)
    if (restTimerRef.current) clearInterval(restTimerRef.current)
  }, [])

  const handleSkipRest = useCallback(() => {
    setShowRestTimer(false)
    if (restTimerRef.current) clearInterval(restTimerRef.current)
  }, [])

  const handleSetUndo = useCallback((exerciseIndex: number, setIndex: number) => {
    if (!activeWorkout) return

    const updatedLogs = activeWorkout.exerciseLogs.map((ex, exIdx) =>
      exIdx === exerciseIndex
        ? {
            ...ex,
            sets: ex.sets.map((set, idx) =>
              idx === setIndex ? { ...set, completed: false } : set
            ),
          }
        : ex
    )
    updateExerciseLogs(updatedLogs)
  }, [activeWorkout, updateExerciseLogs])

  const completedSets = getCompletedSets()
  const totalSets = getTotalSets()
  const isWorkoutComplete = completedSets === totalSets && totalSets > 0

  const handleFinishWorkout = useCallback(async () => {
    if (!activeWorkout) return

    const workoutHistory = {
      id: generateWorkoutId(),
      date: new Date().toISOString(),
      dayNumber: activeWorkout.dayNumber,
      dayName: activeWorkout.dayName,
      duration: activeWorkout.elapsedSeconds,
      exercises: activeWorkout.exerciseLogs,
    }

    // Save to localStorage
    addWorkoutToHistory(workoutHistory)
    setLastCompletedDay(activeWorkout.dayNumber)

    // Sync to Google Sheets if connected
    if (getStoredToken()) {
      try {
        await appendWorkout(workoutHistory)
        // Update dashboard charts (will create them if they don't exist)
        await updateChartsAfterWorkout()
      } catch (error) {
        console.error('Failed to sync to Google Sheets:', error)
        // Continue anyway - data is saved locally
      }
    }

    endWorkout()
    router.push('/')
  }, [activeWorkout, endWorkout, router])

  const handleMinimize = useCallback(() => {
    // Just navigate to home - workout stays active in context
    router.push('/')
  }, [router])

  const handleQuitWorkout = useCallback(() => {
    endWorkout()
    setShowExitConfirm(false)
    // Use setTimeout to ensure state update is flushed before navigation
    setTimeout(() => {
      router.push('/')
    }, 0)
  }, [endWorkout, router])

  // Show loading while workout initializes
  if (!activeWorkout) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground-muted">Starting workout...</div>
      </div>
    )
  }

  // Show focus mode
  if (showFocusMode) {
    return (
      <FocusMode
        exercises={workout.exercises}
        exerciseLogs={activeWorkout.exerciseLogs}
        elapsedSeconds={activeWorkout.elapsedSeconds}
        onSetComplete={handleSetComplete}
        onSetUndo={handleSetUndo}
        onExit={() => setShowFocusMode(false)}
        onFinish={handleFinishWorkout}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background pb-32 animate-slide-down">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b-2 border-border">
        <div className="px-4 py-3">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <button
              onClick={handleMinimize}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Minimize"
            >
              <ChevronDown className="w-5 h-5 text-foreground-muted" />
            </button>
            <div className="text-center">
              <p className="font-bold text-foreground">Day {dayNumber}: {workout.name}</p>
              <p className="text-sm text-foreground-muted">
                {completedSets}/{totalSets} sets
              </p>
            </div>
            <button
              onClick={() => setShowFocusMode(true)}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Focus Mode"
            >
              <Maximize2 className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-duo-green transition-all duration-300"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </div>

        {/* Timer */}
        <WorkoutTimer
          seconds={activeWorkout.elapsedSeconds}
          isPaused={activeWorkout.isPaused}
          onTogglePause={togglePause}
        />
      </header>

      {/* Exercise list */}
      <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {workout.exercises.map((exercise, exIndex) => {
          const exerciseLog = activeWorkout.exerciseLogs[exIndex]
          if (!exerciseLog) return null
          return (
            <ExerciseCard
              key={exercise.name}
              exercise={exercise}
              exerciseIndex={exIndex}
              sets={exerciseLog.sets}
              onSetComplete={(setIndex, reps, weight) =>
                handleSetComplete(exIndex, setIndex, reps, weight)
              }
              isActive={exIndex === activeExerciseIndex}
              onActivate={() => setActiveExerciseIndex(exIndex)}
            />
          )
        })}
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="mx-auto max-w-2xl space-y-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => setShowCompleteDialog(true)}
            disabled={completedSets === 0}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {isWorkoutComplete ? 'Complete Workout' : `Finish Early (${completedSets}/${totalSets})`}
          </Button>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-full text-center text-sm text-foreground-muted hover:text-duo-red transition-colors py-2"
          >
            Cancel Workout
          </button>
        </div>
      </div>

      {/* Rest Timer Modal */}
      {showRestTimer && (
        <RestTimer
          seconds={restSeconds}
          totalSeconds={settings.restTimerSeconds}
          onSkip={handleSkipRest}
          onComplete={handleRestComplete}
        />
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 mx-4 w-full max-w-sm animate-bounce-in">
            <h3 className="text-xl font-bold text-foreground mb-2">Cancel Workout?</h3>
            <p className="text-foreground-muted mb-6">
              Your progress won&apos;t be saved if you cancel now.
            </p>
            <div className="space-y-3">
              <Button variant="outline" className="w-full" onClick={() => setShowExitConfirm(false)}>
                Keep Going
              </Button>
              <Button variant="ghost" className="w-full text-duo-red" onClick={handleQuitWorkout}>
                <X className="w-4 h-4 mr-2" />
                Cancel Workout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Dialog */}
      {showCompleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 mx-4 w-full max-w-sm animate-bounce-in">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-duo-green" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isWorkoutComplete ? 'Great Job!' : 'Finish Early?'}
              </h3>
              <p className="text-foreground-muted">
                {isWorkoutComplete
                  ? `You completed all ${totalSets} sets!`
                  : `You've completed ${completedSets} of ${totalSets} sets.`}
              </p>
            </div>
            <div className="space-y-3">
              <Button variant="primary" className="w-full" onClick={handleFinishWorkout}>
                {isWorkoutComplete ? 'Finish Workout' : 'Save & Finish'}
              </Button>
              {!isWorkoutComplete && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCompleteDialog(false)}
                >
                  Keep Going
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-foreground-muted">Loading workout...</div>
        </div>
      }
    >
      <WorkoutContent />
    </Suspense>
  )
}
