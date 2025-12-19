'use client'

import { cn } from '@/lib/utils'
import type { WorkoutHistory as WorkoutHistoryType } from '@/types/workout'
import { Clock, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface WorkoutHistoryProps {
  workouts: WorkoutHistoryType[]
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }
  return `${mins}m ${secs}s`
}

export default function WorkoutHistory({ workouts }: WorkoutHistoryProps) {
  if (workouts.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-foreground-muted">No workouts yet. Start your first one!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground text-lg px-1">Recent Workouts</h3>
      {workouts.map((workout) => {
        const completedSets = workout.exercises.reduce(
          (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
          0
        )
        const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)

        return (
          <div key={workout.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'bg-duo-green/10'
                  )}
                >
                  <CheckCircle2 className="w-5 h-5 text-duo-green" />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    Day {workout.dayNumber}: {workout.dayName}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {formatDistanceToNow(new Date(workout.date), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-foreground-muted">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatDuration(workout.duration)}</span>
                </div>
                <p className="text-xs text-foreground-muted">
                  {completedSets}/{totalSets} sets
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
