'use client'

import { cn } from '@/lib/utils'
import { getWorkoutDay, getTierColor } from '@/lib/workout-data'
import type { DayNumber } from '@/types/workout'
import { Play, Dumbbell } from 'lucide-react'
import Button from '@/components/ui/Button'
import Link from 'next/link'

interface NextWorkoutCardProps {
  dayNumber: DayNumber
}

export default function NextWorkoutCard({ dayNumber }: NextWorkoutCardProps) {
  const workout = getWorkoutDay(dayNumber)

  return (
    <div className="card-elevated p-6 animate-bounce-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-duo-green/10 flex items-center justify-center">
            <Dumbbell className="w-7 h-7 text-duo-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-duo-green uppercase tracking-wide">
              Up Next
            </p>
            <h2 className="text-xl font-bold text-foreground">Day {dayNumber}: {workout.name}</h2>
          </div>
        </div>
      </div>

      {/* Day Progress Dots */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((day) => (
          <div
            key={day}
            className={cn(
              'flex-1 h-2 rounded-full transition-colors',
              day === dayNumber ? 'bg-duo-green' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Exercise Preview */}
      <div className="space-y-2 mb-6">
        {workout.exercises.map((exercise, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs font-bold px-2 py-1 rounded-lg',
                  getTierColor(exercise.tier)
                )}
              >
                {exercise.tier}
              </span>
              <span className="font-medium text-foreground">{exercise.name}</span>
            </div>
            <span className="text-sm text-foreground-muted font-medium">
              {exercise.sets}x{exercise.reps}
            </span>
          </div>
        ))}
      </div>

      {/* Start Button */}
      <Link href={`/workout?day=${dayNumber}`} className="block">
        <Button variant="primary" size="xl" className="w-full animate-pulse-green">
          <Play className="w-6 h-6 mr-2 fill-current" />
          START
        </Button>
      </Link>
    </div>
  )
}
