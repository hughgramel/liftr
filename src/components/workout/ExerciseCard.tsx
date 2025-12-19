'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { getTierColor } from '@/lib/workout-data'
import { getExerciseWeight, setExerciseWeight } from '@/lib/storage'
import type { Exercise, SetLog } from '@/types/workout'
import { Check, ChevronRight, Minus, Plus } from 'lucide-react'

interface ExerciseCardProps {
  exercise: Exercise
  exerciseIndex: number
  sets: SetLog[]
  onSetComplete: (setIndex: number, reps: number, weight: number) => void
  isActive: boolean
  onActivate: () => void
}

export default function ExerciseCard({
  exercise,
  exerciseIndex,
  sets,
  onSetComplete,
  isActive,
  onActivate,
}: ExerciseCardProps) {
  const [weights, setWeights] = useState<number[]>(() =>
    sets.map((set) => set.weight || getExerciseWeight(exercise.name))
  )
  const [reps, setReps] = useState<number[]>(() =>
    sets.map((set) => set.actualReps || exercise.reps)
  )

  useEffect(() => {
    const savedWeight = getExerciseWeight(exercise.name)
    setWeights(sets.map((set) => set.weight || savedWeight))
    setReps(sets.map((set) => set.actualReps || exercise.reps))
  }, [exercise.name, exercise.reps, sets])

  const completedSets = sets.filter((s) => s.completed).length
  const allCompleted = completedSets === sets.length

  const handleWeightChange = (setIndex: number, newWeight: number) => {
    const clampedWeight = Math.max(0, newWeight)
    setWeights((prev) => {
      const updated = [...prev]
      updated[setIndex] = clampedWeight
      return updated
    })
    setExerciseWeight(exercise.name, clampedWeight)
  }

  const handleRepsChange = (setIndex: number, newReps: number) => {
    const clampedReps = Math.max(0, newReps)
    setReps((prev) => {
      const updated = [...prev]
      updated[setIndex] = clampedReps
      return updated
    })
  }

  const handleSetComplete = (setIndex: number) => {
    const set = sets[setIndex]
    if (set && !set.completed) {
      onSetComplete(setIndex, reps[setIndex] ?? exercise.reps, weights[setIndex] ?? 0)
    }
  }

  return (
    <div
      className={cn(
        'card overflow-hidden transition-all',
        allCompleted && 'opacity-60'
      )}
      onClick={() => !isActive && onActivate()}
    >
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-foreground-muted">{exerciseIndex + 1}</span>
          <span
            className={cn(
              'text-lg font-bold',
              allCompleted ? 'text-duo-green' : 'text-duo-blue'
            )}
          >
            {exercise.name}
          </span>
          <span
            className={cn('text-xs font-bold px-2 py-0.5 rounded', getTierColor(exercise.tier))}
          >
            {exercise.tier}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-foreground-muted" />
      </div>

      {/* Table Header */}
      <div className="px-4 py-2 grid grid-cols-[40px_1fr_80px_56px] gap-2 text-xs font-semibold text-foreground-muted uppercase tracking-wide border-b border-border">
        <div>Set</div>
        <div className="text-center">Weight (lbs)</div>
        <div className="text-center">Reps</div>
        <div></div>
      </div>

      {/* Set Rows */}
      <div className="divide-y divide-border/50">
        {sets.map((set, idx) => {
          return (
            <div
              key={idx}
              className={cn(
                'px-4 py-3 grid grid-cols-[40px_1fr_80px_56px] gap-2 items-center',
                set.completed && 'bg-duo-green/5'
              )}
            >
              {/* Set Number */}
              <div className="text-xl font-bold text-foreground">{idx + 1}</div>

              {/* Weight Input with +/- buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleWeightChange(idx, (weights[idx] || 0) - 5)}
                  disabled={set.completed}
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                    'border-2 border-border bg-white',
                    'active:scale-95 active:bg-gray-100',
                    set.completed && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Minus className="w-5 h-5 text-foreground-muted" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={weights[idx] || ''}
                  onChange={(e) => handleWeightChange(idx, parseInt(e.target.value) || 0)}
                  disabled={set.completed}
                  placeholder="0"
                  className={cn(
                    'flex-1 min-w-0 text-center text-xl font-bold py-2.5 px-2 rounded-xl',
                    'border-2 border-border focus:border-duo-blue focus:outline-none',
                    'bg-white transition-colors',
                    set.completed && 'bg-gray-100 text-foreground-muted'
                  )}
                />
                <button
                  onClick={() => handleWeightChange(idx, (weights[idx] || 0) + 5)}
                  disabled={set.completed}
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                    'border-2 border-border bg-white',
                    'active:scale-95 active:bg-gray-100',
                    set.completed && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Plus className="w-5 h-5 text-foreground-muted" />
                </button>
              </div>

              {/* Reps Input */}
              <input
                type="number"
                inputMode="numeric"
                value={reps[idx] || ''}
                onChange={(e) => handleRepsChange(idx, parseInt(e.target.value) || 0)}
                disabled={set.completed}
                placeholder={exercise.reps.toString()}
                className={cn(
                  'w-full text-center text-xl font-bold py-2.5 px-2 rounded-xl',
                  'border-2 border-border focus:border-duo-blue focus:outline-none',
                  'bg-white transition-colors',
                  set.completed && 'bg-gray-100 text-foreground-muted'
                )}
              />

              {/* Complete Button */}
              <button
                onClick={() => handleSetComplete(idx)}
                disabled={set.completed}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                  'border-2',
                  set.completed
                    ? 'bg-duo-green border-duo-green text-white'
                    : 'border-gray-300 hover:border-duo-green hover:bg-duo-green/10'
                )}
              >
                <Check className={cn('w-6 h-6', set.completed ? 'text-white' : 'text-gray-400')} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
