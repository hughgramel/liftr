'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minimize2, Check, ChevronRight, ChevronLeft, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTierColor } from '@/lib/workout-data'
import { getExerciseWeight, setExerciseWeight } from '@/lib/storage'
import type { Exercise, SetLog } from '@/types/workout'
import Button from '@/components/ui/Button'

interface FocusModeProps {
  exercises: Exercise[]
  exerciseLogs: { name: string; tier: 'T1' | 'T2' | 'T3'; sets: SetLog[] }[]
  elapsedSeconds: number
  onSetComplete: (exerciseIndex: number, setIndex: number, reps: number, weight: number) => void
  onSetUndo: (exerciseIndex: number, setIndex: number) => void
  onExit: () => void
  onFinish: () => void
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function FocusMode({
  exercises,
  exerciseLogs,
  elapsedSeconds,
  onSetComplete,
  onSetUndo,
  onExit,
  onFinish,
}: FocusModeProps) {
  const [weight, setWeight] = useState<number>(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)

  // Find the current exercise and set (first incomplete one)
  const findCurrentPosition = useCallback(() => {
    for (let exIdx = 0; exIdx < exerciseLogs.length; exIdx++) {
      const log = exerciseLogs[exIdx]
      if (!log) continue
      for (let setIdx = 0; setIdx < log.sets.length; setIdx++) {
        const set = log.sets[setIdx]
        if (set && !set.completed) {
          return { exerciseIndex: exIdx, setIndex: setIdx }
        }
      }
    }
    return null // All done
  }, [exerciseLogs])

  // Find the last completed set (for going back)
  const findPreviousCompletedPosition = useCallback(() => {
    let lastCompleted: { exerciseIndex: number; setIndex: number } | null = null
    for (let exIdx = 0; exIdx < exerciseLogs.length; exIdx++) {
      const log = exerciseLogs[exIdx]
      if (!log) continue
      for (let setIdx = 0; setIdx < log.sets.length; setIdx++) {
        const set = log.sets[setIdx]
        if (set && set.completed) {
          lastCompleted = { exerciseIndex: exIdx, setIndex: setIdx }
        }
      }
    }
    return lastCompleted
  }, [exerciseLogs])

  const currentPosition = findCurrentPosition()
  const previousPosition = findPreviousCompletedPosition()
  const currentExercise = currentPosition ? exercises[currentPosition.exerciseIndex] : null
  const currentExerciseLog = currentPosition ? exerciseLogs[currentPosition.exerciseIndex] : null
  const canGoBack = previousPosition !== null

  // Load weight when position changes (only on position change, not on every exerciseLogs update)
  const positionKey = currentPosition
    ? `${currentPosition.exerciseIndex}-${currentPosition.setIndex}`
    : 'done'

  useEffect(() => {
    if (!currentPosition) {
      // We're on the completion screen - load the last set's weight for "Go Back"
      if (previousPosition) {
        const prevLog = exerciseLogs[previousPosition.exerciseIndex]
        const prevSet = prevLog?.sets[previousPosition.setIndex]
        if (prevSet && prevSet.weight > 0) {
          setWeight(prevSet.weight)
        }
      }
      return
    }

    const currentLog = exerciseLogs[currentPosition.exerciseIndex]
    const currentEx = exercises[currentPosition.exerciseIndex]
    if (!currentLog || !currentEx) return

    // First, check if the current set already has a weight logged
    const currentSetData = currentLog.sets[currentPosition.setIndex]
    if (currentSetData && currentSetData.weight > 0) {
      setWeight(currentSetData.weight)
      return
    }

    // Look for the most recent completed set of the same exercise
    const completedSetsOfExercise = currentLog.sets
      .slice(0, currentPosition.setIndex)
      .filter(s => s.completed && s.weight > 0)

    if (completedSetsOfExercise.length > 0) {
      const lastCompletedSet = completedSetsOfExercise[completedSetsOfExercise.length - 1]
      if (lastCompletedSet) {
        setWeight(lastCompletedSet.weight)
        return
      }
    }

    // Fall back to saved default weight for this exercise
    const savedWeight = getExerciseWeight(currentEx.name)
    setWeight(savedWeight > 0 ? savedWeight : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey])

  // Trigger animation when animationKey changes
  useEffect(() => {
    if (animationKey > 0) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [animationKey])

  const handleWeightChange = (delta: number) => {
    setWeight(prev => Math.max(0, prev + delta))
  }

  const handleNextSet = () => {
    if (!currentPosition || !currentExercise) return

    // Save this weight as the default for the exercise
    setExerciseWeight(currentExercise.name, weight)

    // Trigger animation
    setAnimationKey((k) => k + 1)

    onSetComplete(
      currentPosition.exerciseIndex,
      currentPosition.setIndex,
      currentExercise.reps,
      weight
    )
  }

  const handlePreviousSet = () => {
    if (!previousPosition) return
    onSetUndo(previousPosition.exerciseIndex, previousPosition.setIndex)
  }

  // Calculate progress
  const totalSets = exerciseLogs.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = exerciseLogs.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  )

  // All done state
  if (!currentPosition || !currentExercise) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
          <button
            onClick={onExit}
            className="w-12 h-12 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <Minimize2 className="w-6 h-6 text-foreground-muted" />
          </button>
          <span className="font-mono text-2xl font-bold text-foreground">
            {formatTime(elapsedSeconds)}
          </span>
          <div className="w-12" />
        </div>

        {/* Completion */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-24 h-24 rounded-full bg-duo-green/10 flex items-center justify-center mb-6 animate-bounce-in">
            <Check className="w-12 h-12 text-duo-green" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-fade-in">All Sets Done!</h1>
          <p className="text-foreground-muted text-lg mb-8 animate-fade-in">
            {completedSets}/{totalSets} sets completed
          </p>
          <div className="w-full max-w-sm space-y-3 animate-slide-up">
            <Button variant="primary" size="xl" onClick={onFinish} className="w-full">
              Complete Workout
            </Button>
            {canGoBack && (
              <Button variant="outline" size="lg" onClick={handlePreviousSet} className="w-full">
                <ChevronLeft className="w-5 h-5 mr-2" />
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentSetNumber = currentPosition.setIndex + 1
  const totalSetsForExercise = currentExerciseLog?.sets.length || 0

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
        <button
          onClick={onExit}
          className="w-12 h-12 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <Minimize2 className="w-6 h-6 text-foreground-muted" />
        </button>
        <span className="font-mono text-2xl font-bold text-foreground">
          {formatTime(elapsedSeconds)}
        </span>
        <div className="w-12" />
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200">
        <div
          className="h-full bg-duo-green transition-all duration-300"
          style={{ width: `${(completedSets / totalSets) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 py-6 overflow-auto">
        {/* Set indicator - LARGE */}
        <div className={cn('text-center mb-4', isAnimating && 'animate-set-complete')}>
          <p className="text-6xl font-bold text-duo-blue">Set {currentSetNumber}</p>
          <p className="text-lg text-foreground-muted">of {totalSetsForExercise}</p>
        </div>

        {/* Exercise name */}
        <div className="text-center mb-6">
          <span
            className={cn(
              'inline-block text-sm font-bold px-3 py-1 rounded-lg mb-2',
              getTierColor(currentExercise.tier)
            )}
          >
            {currentExercise.tier}
          </span>
          <h1 className="text-2xl font-bold text-foreground">{currentExercise.name}</h1>
        </div>

        {/* Target reps - large display */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={cn(
            'bg-gray-50 rounded-3xl p-8 w-full max-w-sm text-center mb-6',
            isAnimating && 'animate-set-complete'
          )}>
            <p className="text-foreground-muted text-sm font-semibold uppercase tracking-wide mb-2">
              Target Reps
            </p>
            <p className="text-8xl font-bold text-foreground">{currentExercise.reps}</p>
          </div>

          {/* Weight input with +/- buttons */}
          <div className="w-full max-w-md px-4">
            <label className="block text-foreground-muted text-sm font-semibold uppercase tracking-wide mb-2 text-center">
              Weight (lbs)
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleWeightChange(-5)}
                className="w-14 h-14 flex-shrink-0 rounded-2xl bg-gray-100 border-2 border-border flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
              >
                <Minus className="w-6 h-6 text-foreground" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(Math.max(0, parseInt(e.target.value) || 0))}
                className={cn(
                  'w-32 text-center text-4xl font-bold py-3 px-2 rounded-2xl',
                  'border-2 border-border focus:border-duo-blue focus:outline-none',
                  'bg-white transition-colors'
                )}
              />
              <button
                onClick={() => handleWeightChange(5)}
                className="w-14 h-14 flex-shrink-0 rounded-2xl bg-gray-100 border-2 border-border flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
              >
                <Plus className="w-6 h-6 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 pb-4">
          <div className="flex gap-3">
            {canGoBack && (
              <Button variant="outline" size="xl" onClick={handlePreviousSet} className="flex-shrink-0">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}
            <Button variant="primary" size="xl" onClick={handleNextSet} className="flex-1">
              <span>Next Set</span>
              <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
          </div>
          <p className="text-center text-foreground-muted text-sm mt-3">
            {completedSets + 1} of {totalSets} total sets
          </p>
        </div>
      </div>
    </div>
  )
}
